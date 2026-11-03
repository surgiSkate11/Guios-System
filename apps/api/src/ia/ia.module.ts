import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { crearIaCliente, IA_CLIENTE } from './ia-cliente';

@Global()
@Module({
  providers: [
    {
      provide: IA_CLIENTE,
      inject: [ConfigService],
      useFactory: crearIaCliente,
    },
  ],
  exports: [IA_CLIENTE],
})
export class IaModule {}
