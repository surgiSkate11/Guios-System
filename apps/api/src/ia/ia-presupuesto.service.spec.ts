import type { IaCliente, ResultadoIa } from './ia-cliente';
import {
  IaClienteConPresupuesto,
  puedeReservarTokens,
  type PresupuestoTokens,
} from './ia-presupuesto.service';

describe('puedeReservarTokens', () => {
  it('counts completed and concurrent reservations against the rolling limit', () => {
    expect(puedeReservarTokens(400, 500, 100, 1_000)).toBe(true);
    expect(puedeReservarTokens(400, 500, 101, 1_000)).toBe(false);
  });

  it('blocks new requests when the limit is zero', () => {
    expect(puedeReservarTokens(0, 0, 1, 0)).toBe(false);
  });

  it('does not contact the provider when the shared budget is exhausted', async () => {
    const completar = jest.fn().mockResolvedValue('respuesta');
    const cliente: IaCliente = { modelo: 'gemini', completar };
    const presupuesto: PresupuestoTokens = {
      reservar: jest.fn().mockResolvedValue(null),
      registrar: jest.fn(),
    };
    const protegido = new IaClienteConPresupuesto(cliente, presupuesto);

    await expect(
      protegido.completar('instrucciones', 'entrada'),
    ).rejects.toThrow('límite de tokens');
    expect(completar).not.toHaveBeenCalled();
  });

  it('records actual usage and the model returned by the fallback provider', async () => {
    const resultado: ResultadoIa = {
      texto: 'respuesta',
      modelo: 'gemini-alternativo',
      tokensEntrada: 12,
      tokensSalida: 4,
      intentosFallidos: 1,
    };
    const cliente: IaCliente = {
      modelo: 'gemini-principal',
      proveedor: 'gemini',
      intentosMaximos: 3,
      completar: jest.fn(),
      completarConUso: jest.fn().mockResolvedValue(resultado),
    };
    const reservar = jest.fn().mockResolvedValue(7);
    const registrar = jest.fn().mockResolvedValue(undefined);
    const presupuesto: PresupuestoTokens = { reservar, registrar };
    const protegido = new IaClienteConPresupuesto(cliente, presupuesto);

    await expect(protegido.completarConUso('i', 'e')).resolves.toEqual(
      resultado,
    );
    expect(reservar).toHaveBeenCalledWith(
      'gemini',
      'gemini-principal',
      (Buffer.byteLength('i\ne') + 128 + 2048) * 3,
    );
    expect(registrar).toHaveBeenCalledWith(
      7,
      resultado,
      Buffer.byteLength('i\ne') + 128 + 2048,
    );
  });
});
