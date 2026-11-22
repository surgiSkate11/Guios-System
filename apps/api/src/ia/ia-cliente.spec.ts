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

  it('reads the Gemini fallback models from IA_MODELOS_RESPALDO', () => {
    const porDefecto = crearIaCliente(
      config({ IA_API_KEY: 'k' }),
    ) as GeminiCliente;
    expect(porDefecto.respaldo).toEqual([
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite',
    ]);
    const propio = crearIaCliente(
      config({ IA_API_KEY: 'k', IA_MODELOS_RESPALDO: ' a , b ,, ' }),
    ) as GeminiCliente;
    expect(propio.respaldo).toEqual(['a', 'b']);
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

  it('enables Google Search grounding only when web search is requested', async () => {
    const fetchMock = responder(200, {
      candidates: [{ content: { parts: [{ text: 'ok' }] } }],
    });
    const cliente = new GeminiCliente('k', 'm');
    await cliente.completar('i', 'e', { busquedaWeb: true });
    await cliente.completar('i', 'e');
    const cuerpos = fetchMock.mock.calls.map(
      ([, init]) =>
        JSON.parse((init as RequestInit).body as string) as { tools?: unknown },
    );
    expect(cuerpos[0].tools).toEqual([{ googleSearch: {} }]);
    expect(cuerpos[1].tools).toBeUndefined();
  });

  it('falls back to the next model when one is overloaded or unavailable', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: () => Promise.resolve({}),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            candidates: [{ content: { parts: [{ text: 'listo' }] } }],
          }),
      });
    global.fetch = fetchMock;
    const cliente = new GeminiCliente('k', 'principal', ['viejo', 'respaldo']);
    await expect(cliente.completar('i', 'e')).resolves.toBe('listo');
    const modelos = fetchMock.mock.calls.map(
      ([url]) => /models\/(.+):/.exec(url as string)![1],
    );
    expect(modelos).toEqual(['principal', 'viejo', 'respaldo']);
  });

  it('does not try fallback models on a configuration error such as 403', async () => {
    const fetchMock = responder(403, {});
    await expect(
      new GeminiCliente('k', 'm', ['otro']).completar('i', 'e'),
    ).rejects.toThrow('403');
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
