import { Module } from '@nestjs/common';
import { AdministracionModule } from '../administracion.module';
import { ProyectosModule } from '../proyectos/proyectos.module';
import { ResultadosController } from './resultados.controller';
import { ResultadosService } from './resultados.service';

/** Results, comparison flags and audit (A6). */
@Module({
  imports: [ProyectosModule, AdministracionModule],
  controllers: [ResultadosController],
  providers: [ResultadosService],
  exports: [ResultadosService],
})
export class ResultadosModule {}
