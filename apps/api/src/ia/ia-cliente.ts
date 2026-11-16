import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Large language model used to write text and classify evidence. Never computes numbers. */
export interface IaCliente {
  readonly modelo: string;
  completar(instrucciones: string, entrada: string): Promise<string>;
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
const RESPALDO_GEMINI = 'gemini-3.5-flash';
const TIMEOUT_MS = 60_000;
/** Shorter wait while another model remains: an overloaded model may hang instead of answering 503. */
const TIMEOUT_CON_RESPALDO_MS = 20_000;

/** Anthropic Messages API client. The key lives only on the server (RNF-05). */
export class AnthropicCliente implements IaCliente {
  constructor(
    private readonly apiKey: string,
    readonly modelo: string,
  ) {}

  async completar(instrucciones: string, entrada: string): Promise<string> {
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
    };
    const texto = data.content?.find((c) => c.type === 'text')?.text?.trim();
    if (!texto) throw new Error('AI service returned no text');
    return texto;
  }
}

/** Google Gemini generateContent client. The key goes in a header, never in the URL. */
export class GeminiCliente implements IaCliente {
  private readonly logger = new Logger(GeminiCliente.name);

  /**
   * @param respaldo models tried in order when the previous one is overloaded or unavailable
   *   (free-tier models often answer 503 "high demand" for minutes at a time).
   */
  constructor(
    private readonly apiKey: string,
    readonly modelo: string,
    readonly respaldo: string[] = [],
  ) {}

  async completar(instrucciones: string, entrada: string): Promise<string> {
    const modelos = [this.modelo, ...this.respaldo];
    let ultimoError: unknown;
    for (const [i, modelo] of modelos.entries()) {
      try {
        const espera =
          i < modelos.length - 1 ? TIMEOUT_CON_RESPALDO_MS : TIMEOUT_MS;
        const texto = await this.generar(
          modelo,
          instrucciones,
          entrada,
          espera,
        );
        if (i > 0)
          this.logger.warn(`Gemini answered with fallback model ${modelo}`);
        return texto;
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
  ) {
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
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const texto = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? '')
      .join('')
      .trim();
    if (!texto) throw new Error('AI service returned no text');
    return texto;
  }
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
