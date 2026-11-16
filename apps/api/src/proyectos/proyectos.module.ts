import { Module } from '@nestjs/common';
import { AccesoService } from './acceso.service';
import {
  ProyectosController,
  SolicitudesController,
} from './proyectos.controller';
import { ProyectosService } from './proyectos.service';
import { SugerenciaIsService } from './sugerencia-is.service';

@Module({
  controllers: [ProyectosController, SolicitudesController],
  providers: [ProyectosService, AccesoService, SugerenciaIsService],
  exports: [AccesoService],
})
export class ProyectosModule {}
