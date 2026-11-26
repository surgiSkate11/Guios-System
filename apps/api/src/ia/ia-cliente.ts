import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Large language model used to write text and classify evidence. Never computes numbers. */
export interface OpcionesIa {
  /** Let the model search the web (Gemini Google Search grounding); ignored by other providers. */
  busquedaWeb?: boolean;
}

export interface IaCliente {
  readonly modelo: string;
  readonly proveedor?: string;
  readonly intentosMaximos?: number;
  completar(
    instrucciones: string,
    entrada: string,
    opciones?: OpcionesIa,
  ): Promise<string>;
  completarConUso?(
    instrucciones: string,
    entrada: string,
    opciones?: OpcionesIa,
  ): Promise<ResultadoIa>;
  completarConProgreso?(
    instrucciones: string,
    entrada: string,
    onFragmento: (fragmento: string, modelo: string) => void,
    opciones?: OpcionesIa,
  ): Promise<ResultadoIa>;
}

export interface ResultadoIa {
  texto: string;
  modelo: string;
  tokensEntrada: number | null;
  tokensSalida: number | null;
  intentosFallidos: number;
}

/** Injection token; resolves to null when no AI is configured (RNF-06 fallbacks apply). */
export const IA_CLIENTE = Symbol('IA_CLIENTE');

/** Default model of each supported provider (IA_PROVEEDOR). */
const MODELOS_POR_DEFECTO = {
  gemini: 'gemini-3.8-flash',
  anthropic: 'claude-haiku-5-5',
} as const;
type Proveedor = keyof typeof MODELOS_POR_DEFECTO;
/** Default IA_MODELOS_RESPALDO for Gemini. */
const RESPALDO_GEMINI =
  'gemini-3.5-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite';
const TIMEOUT_MS = 60_000;
/** Shorter wait while another model remains: an overloaded model may hang instead of answering 503. */
const TIMEOUT_CON_RESPALDO_MS = 20_000;

/** Anthropic Messages API client. The key lives only on the server (RNF-05). */
export class AnthropicCliente implements IaCliente {
  readonly proveedor = 'anthropic';

  constructor(
    private readonly apiKey: string,
    readonly modelo: string,
  ) {}

  async completar(instrucciones: string, entrada: string): Promise<string> {
    return (await this.completarConUso(instrucciones, entrada)).texto;
  }

  async completarConUso(
    instrucciones: string,
    entrada: string,
  ): Promise<ResultadoIa> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.modelo,
        max_tokens: 2048,
        system: instrucciones,
        messages: [{ role: 'user', content: entrada }],
      }),
    });
    if (!res.ok) throw new Error(`AI service answered ${res.status}`);
    const data = (await res.json()) as {
      content?: { type: string; text?: string }[];
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
        cache_read_input_tokens?: number;
        cache_creation_input_tokens?: number;
      };
    };
    const texto = data.content?.find((c) => c.type === 'text')?.text?.trim();
    if (!texto) throw new Error('AI service returned no text');
    return {
      texto,
      modelo: this.modelo,
      tokensEntrada: sumaTokens(
        data.usage?.input_tokens,
        data.usage?.cache_read_input_tokens,
        data.usage?.cache_creation_input_tokens,
      ),
      tokensSalida: tokenValido(data.usage?.output_tokens),
      intentosFallidos: 0,
    };
  }
}

/** Google Gemini generateContent client. The key goes in a header, never in the URL. */
export class GeminiCliente implements IaCliente {
  private readonly logger = new Logger(GeminiCliente.name);
  readonly proveedor = 'gemini';
  readonly intentosMaximos: number;

  /**
   * @param respaldo models tried in order when the previous one is overloaded or unavailable
   *   (free-tier models often answer 503 "high demand" for minutes at a time).
   */
  constructor(
    private readonly apiKey: string,
    readonly modelo: string,
    readonly respaldo: string[] = [],
  ) {
    this.intentosMaximos = 1 + respaldo.length;
  }

  async completar(
    instrucciones: string,
    entrada: string,
    opciones?: OpcionesIa,
  ): Promise<string> {
    return (await this.completarConUso(instrucciones, entrada, opciones)).texto;
  }

  async completarConUso(
    instrucciones: string,
    entrada: string,
    opciones?: OpcionesIa,
  ): Promise<ResultadoIa> {
    return this.consultar((modelo, espera) =>
      this.generar(modelo, instrucciones, entrada, espera, opciones),
    );
  }

  async completarConProgreso(
    instrucciones: string,
    entrada: string,
    onFragmento: (fragmento: string, modelo: string) => void,
    opciones?: OpcionesIa,
  ): Promise<ResultadoIa> {
    return this.consultar((modelo, espera) =>
      this.generarEnFlujo(
        modelo,
        instrucciones,
        entrada,
        espera,
        onFragmento,
        opciones,
      ),
    );
  }

  private async consultar(
    generar: (
      modelo: string,
      espera: number,
    ) => Promise<Omit<ResultadoIa, 'intentosFallidos'>>,
  ): Promise<ResultadoIa> {
    const modelos = [this.modelo, ...this.respaldo];
    let ultimoError: unknown;
    for (const [i, modelo] of modelos.entries()) {
      try {
        const espera =
          i < modelos.length - 1 ? TIMEOUT_CON_RESPALDO_MS : TIMEOUT_MS;
        const resultado = await generar(modelo, espera);
        if (i > 0)
          this.logger.warn(`Gemini answered with fallback model ${modelo}`);
        return { ...resultado, modelo, intentosFallidos: i };
      } catch (error) {
        if (!(error instanceof FallaTransitoria)) throw error;
        ultimoError = error.causa;
      }
    }
    throw ultimoError;
  }

  private async generar(
    modelo: string,
    instrucciones: string,
    entrada: string,
    espera: number,
    opciones?: OpcionesIa,
  ): Promise<Omit<ResultadoIa, 'intentosFallidos'>> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        signal: AbortSignal.timeout(espera),
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: instrucciones }] },
          contents: [{ role: 'user', parts: [{ text: entrada }] }],
          generationConfig: { maxOutputTokens: 2048 },
          ...(opciones?.busquedaWeb ? { tools: [{ googleSearch: {} }] } : {}),
        }),
      });
    } catch (error) {
      // Timeouts and network failures: another model may still answer.
      throw new FallaTransitoria(error);
    }
    if (!res.ok) {
      const error = new Error(`AI service answered ${res.status}`);
      // 404 (model retired), 429 (quota) and 5xx (overloaded) are worth another model;
      // 400/401/403 are configuration errors that no model will fix.
      if (res.status === 404 || res.status === 429 || res.status >= 500) {
        throw new FallaTransitoria(error);
      }
      throw error;
    }
    const data = (await res.json()) as GeminiRespuesta;
    const texto = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? '')
      .join('')
      .trim();
    if (!texto) throw new Error('AI service returned no text');
    return { texto, modelo, ...usoGemini(data.usageMetadata) };
  }

  private async generarEnFlujo(
    modelo: string,
    instrucciones: string,
    entrada: string,
    espera: number,
    onFragmento: (fragmento: string, modelo: string) => void,
    opciones?: OpcionesIa,
  ): Promise<Omit<ResultadoIa, 'intentosFallidos'>> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:streamGenerateContent?alt=sse`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        signal: AbortSignal.timeout(espera),
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: instrucciones }] },
          contents: [{ role: 'user', parts: [{ text: entrada }] }],
          generationConfig: { maxOutputTokens: 2048 },
          ...(opciones?.busquedaWeb ? { tools: [{ googleSearch: {} }] } : {}),
        }),
      });
    } catch (error) {
      throw new FallaTransitoria(error);
    }
    if (!res.ok) {
      const error = new Error(`AI service answered ${res.status}`);
      if (res.status === 404 || res.status === 429 || res.status >= 500) {
        throw new FallaTransitoria(error);
      }
      throw error;
    }
    try {
      const resultado = await leerFlujoGemini(res, (fragmento) =>
        onFragmento(fragmento, modelo),
      );
      if (!resultado.texto.trim()) {
        throw new Error('AI service returned no text');
      }
      return { ...resultado, modelo };
    } catch (error) {
      throw new FallaTransitoria(error);
    }
  }
}

interface GeminiRespuesta {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
    totalTokenCount?: number;
  };
}

function tokenValido(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= 0
    ? valor
    : null;
}

function sumaTokens(...valores: unknown[]): number | null {
  const validos = valores.map(tokenValido);
  if (validos.every((valor) => valor === null)) return null;
  return validos.reduce<number>((total, valor) => total + (valor ?? 0), 0);
}

function usoGemini(uso: GeminiRespuesta['usageMetadata']) {
  const tokensEntrada = tokenValido(uso?.promptTokenCount);
  const total = tokenValido(uso?.totalTokenCount);
  const tokensSalida =
    total !== null
      ? Math.max(0, total - (tokensEntrada ?? 0))
      : sumaTokens(uso?.candidatesTokenCount, uso?.thoughtsTokenCount);
  return { tokensEntrada, tokensSalida };
}

async function leerFlujoGemini(
  respuesta: Response,
  onFragmento: (fragmento: string) => void,
): Promise<Omit<ResultadoIa, 'modelo' | 'intentosFallidos'>> {
  const lector = respuesta.body?.getReader();
  if (!lector) throw new Error('AI service returned no stream');
  const decoder = new TextDecoder();
  let buffer = '';
  let texto = '';
  let tokensEntrada: number | null = null;
  let tokensSalida: number | null = null;

  const procesarEvento = (evento: string) => {
    const lineas = evento
      .split(/\r?\n/)
      .filter((linea) => linea.startsWith('data:'))
      .map((linea) => linea.slice(5).trim());
    if (lineas.length === 0) return;
    const datos = lineas.join('\n');
    if (!datos || datos === '[DONE]') return;
    const respuesta = JSON.parse(datos) as GeminiRespuesta;
    const fragmento = (respuesta.candidates?.[0]?.content?.parts ?? [])
      .map((parte) => parte.text ?? '')
      .join('');
    if (fragmento) {
      texto += fragmento;
      onFragmento(fragmento);
    }
    const uso = usoGemini(respuesta.usageMetadata);
    tokensEntrada = uso.tokensEntrada ?? tokensEntrada;
    tokensSalida = uso.tokensSalida ?? tokensSalida;
  };

  while (true) {
    const { done, value } = await lector.read();
    buffer += decoder.decode(value, { stream: !done });
    buffer = buffer.replace(/\r\n/g, '\n');
    let separador = buffer.indexOf('\n\n');
    while (separador >= 0) {
      procesarEvento(buffer.slice(0, separador));
      buffer = buffer.slice(separador + 2);
      separador = buffer.indexOf('\n\n');
    }
    if (done) break;
  }
  if (buffer.trim()) procesarEvento(buffer);
  return { texto, tokensEntrada, tokensSalida };
}

export function crearIaCliente(config: ConfigService): IaCliente | null {
  const apiKey = config.get<string>('IA_API_KEY');
  if (!apiKey) return null;
  const proveedor = (
    config.get<string>('IA_PROVEEDOR') ?? 'gemini'
  ).toLowerCase();
  if (!(proveedor in MODELOS_POR_DEFECTO)) {
    throw new Error(
      `IA_PROVEEDOR must be one of: ${Object.keys(MODELOS_POR_DEFECTO).join(', ')}`,
    );
  }
  const modelo =
    config.get<string>('IA_MODELO') ??
    MODELOS_POR_DEFECTO[proveedor as Proveedor];
  if (proveedor === 'anthropic') return new AnthropicCliente(apiKey, modelo);
  const respaldo = (
    config.get<string>('IA_MODELOS_RESPALDO') ?? RESPALDO_GEMINI
  )
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  return new GeminiCliente(apiKey, modelo, respaldo);
}

/** Error after which the next fallback model is tried. */
class FallaTransitoria extends Error {
  constructor(readonly causa: unknown) {
    super(causa instanceof Error ? causa.message : String(causa));
  }
}
