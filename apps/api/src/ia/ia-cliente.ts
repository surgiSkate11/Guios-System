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
const TIMEOUT_MS = 60_000;

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
  constructor(
    private readonly apiKey: string,
    readonly modelo: string,
  ) {}

  async completar(instrucciones: string, entrada: string): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.modelo)}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': this.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instrucciones }] },
        contents: [{ role: 'user', parts: [{ text: entrada }] }],
      }),
    });
    if (!res.ok) throw new Error(`AI service answered ${res.status}`);
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
  return proveedor === 'anthropic'
    ? new AnthropicCliente(apiKey, modelo)
    : new GeminiCliente(apiKey, modelo);
}
