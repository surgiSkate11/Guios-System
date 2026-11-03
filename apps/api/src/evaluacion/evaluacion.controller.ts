import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  Equals,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { CurrentUser } from '../auth/decorators';
import type { UsuarioPublico } from '../auth/usuario-publico';
import { Alcance } from '../generated/prisma/client';
import { ConsolidacionService } from './consolidacion.service';
import { RespuestasService } from './respuestas.service';

class ImportanciaDto {
  @IsInt()
  @Min(1)
  @Max(4)
  impDecisor!: number;
}

/** Exactly one of `valor` (1-4) or `desconozco: true`. */
class CalificacionDto {
  @IsInt()
  idSoftware!: number;

  @IsInt()
  idSubfactor!: number;

  @ValidateIf((o: CalificacionDto) => o.desconozco === undefined)
  @IsInt()
  @Min(1)
  @Max(4)
  valor?: number;

  @ValidateIf(
    (o: CalificacionDto) => o.valor === undefined || o.desconozco !== undefined,
  )
  @Equals(true)
  @ValidateIf(
    (o: CalificacionDto) => o.valor === undefined || o.desconozco !== undefined,
  )
  desconozco?: true;
}

class AlcanceDto {
  @IsEnum(Alcance)
  alcance!: Alcance;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  justificacion?: string;
}

@Controller('proyectos/:id')
export class EvaluacionController {
  constructor(
    private readonly respuestas: RespuestasService,
    private readonly consolidacion: ConsolidacionService,
  ) {}

  @Get('importancias/mias')
  misImportancias(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() u: UsuarioPublico,
  ) {
    return this.respuestas.misImportancias(id, u);
  }

  @Put('importancias/:idProyectoFactor')
  guardarImportancia(
    @Param('id', ParseIntPipe) id: number,
    @Param('idProyectoFactor', ParseIntPipe) idPf: number,
    @CurrentUser() u: UsuarioPublico,
    @Body() body: ImportanciaDto,
  ) {
    return this.respuestas.guardarImportancia(id, idPf, u, body.impDecisor);
  }

  @Get('calificaciones/mias')
  misCalificaciones(
    @Param('id', ParseIntPipe) id: number,
    @Query('software', ParseIntPipe) idSoftware: number,
    @CurrentUser() u: UsuarioPublico,
  ) {
    return this.respuestas.misCalificaciones(id, idSoftware, u);
  }

  @Put('calificaciones')
  calificar(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() u: UsuarioPublico,
    @Body() body: CalificacionDto,
  ) {
    return this.respuestas.calificar(id, u, body);
  }

  @Get('consolidacion')
  verConsolidacion(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() u: UsuarioPublico,
  ) {
    return this.consolidacion.obtener(id, u);
  }

  @Post('consolidacion/confirmar')
  @HttpCode(HttpStatus.CREATED)
  confirmar(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() u: UsuarioPublico,
  ) {
    return this.consolidacion.confirmar(id, u);
  }

  @Patch('factores/:idProyectoFactor/alcance')
  cambiarAlcance(
    @Param('id', ParseIntPipe) id: number,
    @Param('idProyectoFactor', ParseIntPipe) idPf: number,
    @CurrentUser() u: UsuarioPublico,
    @Body() body: AlcanceDto,
  ) {
    return this.consolidacion.cambiarAlcance(
      id,
      idPf,
      u,
      body.alcance,
      body.justificacion,
    );
  }
}
