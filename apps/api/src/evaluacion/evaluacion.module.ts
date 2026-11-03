import { Module } from '@nestjs/common';
import { ProyectosModule } from '../proyectos/proyectos.module';
import { ConsolidacionService } from './consolidacion.service';
import { EvaluacionController } from './evaluacion.controller';
import { RespuestasService } from './respuestas.service';

/** Judge answers (A4) and consolidation (A5). */
@Module({
  imports: [ProyectosModule],
  controllers: [EvaluacionController],
  providers: [RespuestasService, ConsolidacionService],
  exports: [ConsolidacionService],
})
export class EvaluacionModule {}
