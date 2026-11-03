import { Module } from '@nestjs/common';
import { OrganizacionesController } from './organizaciones/organizaciones.controller';
import { ParametrosController } from './parametros/parametros.controller';
import { ParametrosService } from './parametros/parametros.service';
import { UsuariosController } from './usuarios/usuarios.controller';

/** Administration (A1): organizations, users and analysis parameters. */
@Module({
  controllers: [
    OrganizacionesController,
    UsuariosController,
    ParametrosController,
  ],
  providers: [ParametrosService],
  exports: [ParametrosService],
})
export class AdministracionModule {}
