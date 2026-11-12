import type { ConfigService } from '@nestjs/config';
import { AnthropicCliente, crearIaCliente, GeminiCliente } from './ia-cliente';

const config = (valores: Record<string, string>) =>
  ({ get: (clave: string) => valores[clave] }) as unknown as ConfigService;

describe('crearIaCliente', () => {
  it('returns null when no API key is configured', () => {
    expect(crearIaCliente(config({}))).toBeNull();
  });

  it('uses Gemini by default with its default model', () => {
    const cliente = crearIaCliente(config({ IA_API_KEY: 'k' }));
    expect(cliente).toBeInstanceOf(GeminiCliente);
    expect(cliente!.modelo).toBe('gemini-3.8-flash');
  });

  it('honors IA_PROVEEDOR and IA_MODELO', () => {
    const cliente = crearIaCliente(
      config({ IA_API_KEY: 'k', IA_PROVEEDOR: 'anthropic', IA_MODELO: 'otro' }),
    );
    expect(cliente).toBeInstanceOf(AnthropicCliente);
    expect(cliente!.modelo).toBe('otro');
  });

  it('rejects an unknown provider with a clear message', () => {
    expect(() =>
      crearIaCliente(config({ IA_API_KEY: 'k', IA_PROVEEDOR: 'otro' })),
    ).toThrow('IA_PROVEEDOR');
  });
});

describe('GeminiCliente', () => {
  const fetchOriginal = global.fetch;
  afterEach(() => {
    global.fetch = fetchOriginal;
  });

  function responder(status: number, body: unknown) {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    });
    global.fetch = fetchMock;
    return fetchMock;
  }

  it('calls generateContent with the key in a header and joins the text parts', async () => {
    const fetchMock = responder(200, {
      candidates: [
        { content: { parts: [{ text: 'Hola ' }, { text: 'mundo' }] } },
      ],
    });
    const texto = await new GeminiCliente(
      'secreta',
      'gemini-3.8-flash',
    ).completar('instrucciones', 'entrada');
    expect(texto).toBe('Hola mundo');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent',
    );
    // The key travels in a header, never in the URL (it would end up in logs).
    expect(url).not.toContain('secreta');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe(
      'secreta',
    );
    expect(JSON.parse(init.body as string)).toEqual({
      systemInstruction: { parts: [{ text: 'instrucciones' }] },
      contents: [{ role: 'user', parts: [{ text: 'entrada' }] }],
    });
  });

  it('fails on an HTTP error or an empty answer', async () => {
    responder(429, {});
    await expect(
      new GeminiCliente('k', 'm').completar('i', 'e'),
    ).rejects.toThrow('429');
    responder(200, { candidates: [] });
    await expect(
      new GeminiCliente('k', 'm').completar('i', 'e'),
    ).rejects.toThrow('no text');
  });
});
