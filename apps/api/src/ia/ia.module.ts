import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { crearIaCliente, IA_CLIENTE } from './ia-cliente';
import {
  IaClienteConPresupuesto,
  IaPresupuestoService,
} from './ia-presupuesto.service';

@Global()
@Module({
  providers: [
    IaPresupuestoService,
    {
      provide: IA_CLIENTE,
      inject: [ConfigService, IaPresupuestoService],
      useFactory: (
        config: ConfigService,
        presupuesto: IaPresupuestoService,
      ) => {
        const cliente = crearIaCliente(config);
        return cliente
          ? new IaClienteConPresupuesto(cliente, presupuesto)
          : null;
      },
    },
  ],
  exports: [IA_CLIENTE],
})
export class IaModule {}
