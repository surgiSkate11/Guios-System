import { Body, Controller, Get, Put } from '@nestjs/common';
import { IsEnum, IsNumber, Max, Min } from 'class-validator';
import { Roles } from '../auth/decorators';
import { MetodoConsolidacion } from '../generated/prisma/client';
import { ParametrosService, type Parametros } from './parametros.service';

class ParametrosDto implements Parametros {
  @IsNumber() @Min(1) @Max(4) umbralFoda!: number;
  @IsNumber() @Min(0) @Max(100) umbralDesacuerdo!: number;
  @IsNumber() @Min(0) @Max(100) umbralEmpateTecnico!: number;
  @IsNumber() @Min(0) @Max(100) umbralMetricaAlta!: number;
  @IsNumber() @Min(0) @Max(3) umbralFactorDiscutido!: number;
  @IsNumber() @Min(0) @Max(100) umbralDatosInciertos!: number;
  @IsEnum(MetodoConsolidacion) metodoConsolidacion!: MetodoConsolidacion;
}

@Controller('parametros')
export class ParametrosController {
  constructor(private readonly parametros: ParametrosService) {}

  @Get()
  obtener(): Promise<Parametros> {
    return this.parametros.obtener();
  }

  @Put()
  @Roles('administrador')
  reemplazar(@Body() body: ParametrosDto): Promise<Parametros> {
    return this.parametros.reemplazar(body);
  }
}
