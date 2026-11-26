import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import type { IaCliente, OpcionesIa, ResultadoIa } from './ia-cliente';

const LIMITE_POR_DEFECTO = 900_000;
const PERIODO_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_TOKENS_SALIDA = 2048;
const MARGEN_TOKENS_ENTRADA = 128;
const BLOQUEO_PRESUPUESTO = 741_902_126;

export class PresupuestoIaAgotadoError extends Error {
  constructor() {
    super('Se alcanzó el límite de tokens de IA de los últimos 7 días');
    this.name = 'PresupuestoIaAgotadoError';
  }
}

export function puedeReservarTokens(
  usados: number,
  reservados: number,
  nuevos: number,
  limite: number,
): boolean {
  return usados + reservados + nuevos <= limite;
}

export interface PresupuestoTokens {
  reservar(
    proveedor: string,
    modelo: string,
    tokens: number,
  ): Promise<number | null>;
  registrar(
    id: number,
    resultado: ResultadoIa,
    tokensReservados: number,
  ): Promise<unknown>;
}

@Injectable()
export class IaPresupuestoService implements PresupuestoTokens {
  private readonly limite: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    const valor = Number(
      config.get<string>('IA_TOKENS_LIMITE') ?? LIMITE_POR_DEFECTO,
    );
    if (!Number.isSafeInteger(valor) || valor < 0) {
      throw new Error('IA_TOKENS_LIMITE debe ser un entero no negativo');
    }
    this.limite = valor;
  }

  async reservar(
    proveedor: string,
    modelo: string,
    tokens: number,
  ): Promise<number | null> {
    const desde = new Date(Date.now() - PERIODO_MS);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS bloqueado FROM (SELECT pg_advisory_xact_lock(${BLOQUEO_PRESUPUESTO})) AS lock`;
      await tx.usoTokensIa.deleteMany({ where: { creadoEn: { lt: desde } } });
      const uso = await tx.usoTokensIa.aggregate({
        where: { creadoEn: { gte: desde } },
        _sum: {
          tokensEntrada: true,
          tokensSalida: true,
          tokensReservados: true,
        },
      });
      const usados =
        (uso._sum.tokensEntrada ?? 0) + (uso._sum.tokensSalida ?? 0);
      const reservados = uso._sum.tokensReservados ?? 0;
      if (!puedeReservarTokens(usados, reservados, tokens, this.limite)) {
        return null;
      }
      const registro = await tx.usoTokensIa.create({
        data: {
          proveedor,
          modelo,
          tokensReservados: tokens,
        },
        select: { id: true },
      });
      return registro.id;
    });
  }

  registrar(
    id: number,
    resultado: ResultadoIa,
    tokensReservados: number,
  ): Promise<unknown> {
    return this.prisma.usoTokensIa.update({
      where: { id },
      data: {
        modelo: resultado.modelo,
        tokensEntrada: resultado.tokensEntrada ?? 0,
        tokensSalida: resultado.tokensSalida ?? 0,
        tokensReservados,
      },
    });
  }
}

/** Adds a persistent, shared token cap to any configured provider. */
export class IaClienteConPresupuesto implements IaCliente {
  readonly modelo: string;
  readonly proveedor: string;
  readonly intentosMaximos: number;

  constructor(
    private readonly cliente: IaCliente,
    private readonly presupuesto: PresupuestoTokens,
  ) {
    this.modelo = cliente.modelo;
    this.proveedor = cliente.proveedor ?? 'desconocido';
    this.intentosMaximos = Math.max(1, cliente.intentosMaximos ?? 1);
  }

  async completar(
    instrucciones: string,
    entrada: string,
    opciones?: OpcionesIa,
  ): Promise<string> {
    return (await this.ejecutar(instrucciones, entrada, opciones)).texto;
  }

  completarConUso(
    instrucciones: string,
    entrada: string,
    opciones?: OpcionesIa,
  ): Promise<ResultadoIa> {
    return this.ejecutar(instrucciones, entrada, opciones);
  }

  completarConProgreso(
    instrucciones: string,
    entrada: string,
    onFragmento: (fragmento: string, modelo: string) => void,
    opciones?: OpcionesIa,
  ): Promise<ResultadoIa> {
    return this.ejecutar(instrucciones, entrada, opciones, onFragmento);
  }

  private async ejecutar(
    instrucciones: string,
    entrada: string,
    opciones?: OpcionesIa,
    onFragmento?: (fragmento: string, modelo: string) => void,
  ): Promise<ResultadoIa> {
    const tokensPorIntento =
      Buffer.byteLength(`${instrucciones}\n${entrada}`, 'utf8') +
      MARGEN_TOKENS_ENTRADA +
      MAX_TOKENS_SALIDA;
    const id = await this.presupuesto.reservar(
      this.proveedor,
      this.modelo,
      tokensPorIntento * this.intentosMaximos,
    );
    if (id === null) throw new PresupuestoIaAgotadoError();

    let resultado: ResultadoIa;
    if (onFragmento && this.cliente.completarConProgreso) {
      resultado = await this.cliente.completarConProgreso(
        instrucciones,
        entrada,
        onFragmento,
        opciones,
      );
    } else if (this.cliente.completarConUso) {
      resultado = await this.cliente.completarConUso(
        instrucciones,
        entrada,
        opciones,
      );
    } else {
      resultado = {
        texto: await this.cliente.completar(instrucciones, entrada, opciones),
        modelo: this.modelo,
        tokensEntrada: null,
        tokensSalida: null,
        intentosFallidos: 0,
      };
    }

    const fallidos = Math.min(
      this.intentosMaximos - 1,
      Math.max(0, resultado.intentosFallidos),
    );
    const tokensSinMedir =
      resultado.tokensEntrada === null || resultado.tokensSalida === null;
    const restantes = (fallidos + (tokensSinMedir ? 1 : 0)) * tokensPorIntento;
    await this.presupuesto.registrar(id, resultado, restantes);
    return resultado;
  }
}
