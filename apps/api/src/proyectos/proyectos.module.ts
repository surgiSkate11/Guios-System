import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BIBLIOGRAFIA, OpenAlex } from '../catalogo/bibliografia';
import { AccesoService } from './acceso.service';
import {
  ProyectosController,
  SolicitudesController,
} from './proyectos.controller';
import { ProyectosService } from './proyectos.service';
import { SugerenciaIsService } from './sugerencia-is.service';

@Module({
  controllers: [ProyectosController, SolicitudesController],
  providers: [
    ProyectosService,
    AccesoService,
    SugerenciaIsService,
    {
      provide: BIBLIOGRAFIA,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new OpenAlex(config.get<string>('OPENALEX_MAILTO')),
    },
  ],
  exports: [AccesoService],
})
export class ProyectosModule {}
