import { Inject, Injectable } from '@nestjs/common';
import { IA_CLIENTE, type IaCliente } from '../ia/ia-cliente';
import { PrismaService } from '../prisma/prisma.service';
import { BIBLIOGRAFIA, type Bibliografia } from './bibliografia';
import { CatalogoAdminService } from './catalogo-admin.service';
import type { Estimacion } from './estimacion';

/** Form 2: AI-assisted citation estimation (RF-23). Implemented in the next step. */
@Injectable()
export class EstimacionIaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogo: CatalogoAdminService,
    @Inject(IA_CLIENTE) private readonly ia: IaCliente | null,
    @Inject(BIBLIOGRAFIA) private readonly bibliografia: Bibliografia,
  ) {}

  get disponible(): boolean {
    return this.ia !== null;
  }

  iniciar(_idFactor: number): Promise<Estimacion> {
    return Promise.reject(new Error('Not implemented'));
  }
}
