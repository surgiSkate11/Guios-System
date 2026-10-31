import { Module } from '@nestjs/common';
import { AccesoService } from './acceso.service';
import {
  ProyectosController,
  SolicitudesController,
} from './proyectos.controller';
import { ProyectosService } from './proyectos.service';

@Module({
  controllers: [ProyectosController, SolicitudesController],
  providers: [ProyectosService, AccesoService],
  exports: [AccesoService],
})
export class ProyectosModule {}
