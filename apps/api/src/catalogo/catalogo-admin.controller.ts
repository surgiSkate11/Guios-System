import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { CurrentUser, Roles } from '../auth/decorators';
import type { UsuarioPublico } from '../auth/usuario-publico';
import { Alcance, EstadoEstimacionIs } from '../generated/prisma/client';
import { CatalogoAdminService } from './catalogo-admin.service';
import { DOI_VALIDO } from './estimacion';
import { EstimacionIaService } from './estimacion-ia.service';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

class SubfactorCitasDto {
  @Transform(trim)
  @IsString()
  @Length(1, 300)
  texto!: string;

  @IsInt()
  @Min(0)
  citas!: number;

  @IsOptional()
  @IsArray()
  @Matches(DOI_VALIDO, { each: true, message: 'Algún DOI no es válido' })
  dois?: string[];
}

class NuevoFactorDto {
  @IsInt()
  idDimension!: number;

  @Transform(trim)
  @IsString()
  @Length(2, 150)
  nombre!: string;

  @IsEnum(Alcance)
  alcanceDefault!: Alcance;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SubfactorCitasDto)
  subfactores!: SubfactorCitasDto[];
}

class CitaCorregidaDto {
  @IsInt()
  idSubfactor!: number;

  @IsInt()
  @Min(0)
  citas!: number;
}

class AprobarDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CitaCorregidaDto)
  citas?: CitaCorregidaDto[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  isAprobada?: number;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  justificacion?: string;
}

class RechazarDto {
  @Transform(trim)
  @IsString()
  @Length(1, 500)
  justificacion!: string;
}

class ActualizarFactorDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 150)
  nombre?: string;

  @IsOptional()
  @IsEnum(Alcance)
  alcanceDefault?: Alcance;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

class SubfactorDto {
  @Transform(trim)
  @IsString()
  @Length(1, 300)
  texto!: string;
}

class ActualizarSubfactorDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 300)
  texto?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

/** Catalog administration (A10). Administrators only. */
@Controller('catalogo')
@Roles('administrador')
export class CatalogoAdminController {
  constructor(
    private readonly catalogo: CatalogoAdminService,
    @Inject(EstimacionIaService) private readonly ia: EstimacionIaService,
  ) {}

  @Get('factores')
  factores() {
    return this.catalogo.factores();
  }

  @Post('factores')
  crear(@Body() body: NuevoFactorDto) {
    return this.catalogo.crearFactor(body);
  }

  @Patch('factores/:id')
  actualizarFactor(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ActualizarFactorDto,
  ) {
    return this.catalogo.actualizarFactor(id, body);
  }

  @Post('factores/:id/subfactores')
  agregarSubfactor(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: SubfactorDto,
  ) {
    return this.catalogo.agregarSubfactor(id, body.texto);
  }

  @Patch('subfactores/:id')
  actualizarSubfactor(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ActualizarSubfactorDto,
  ) {
    return this.catalogo.actualizarSubfactor(id, body);
  }

  @Post('factores/:id/estimaciones')
  @HttpCode(HttpStatus.ACCEPTED)
  estimarConIa(@Param('id', ParseIntPipe) id: number) {
    if (!this.ia.disponible) {
      throw new ConflictException('La estimación con IA no está configurada');
    }
    return this.ia.iniciar(id);
  }

  @Get('estimaciones')
  estimaciones(
    @Query('estado', new ParseEnumPipe(EstadoEstimacionIs, { optional: true }))
    estado?: EstadoEstimacionIs,
  ) {
    return this.catalogo.estimaciones(estado);
  }

  @Get('estimaciones/:id')
  estimacion(@Param('id', ParseIntPipe) id: number) {
    return this.catalogo.estimacion(id);
  }

  @Post('estimaciones/:id/aprobar')
  @HttpCode(HttpStatus.OK)
  aprobar(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() admin: UsuarioPublico,
    @Body() body: AprobarDto,
  ) {
    return this.catalogo.aprobar(id, admin, body);
  }

  @Post('estimaciones/:id/rechazar')
  @HttpCode(HttpStatus.OK)
  rechazar(@Param('id', ParseIntPipe) id: number, @Body() body: RechazarDto) {
    return this.catalogo.rechazar(id, body.justificacion);
  }
}
