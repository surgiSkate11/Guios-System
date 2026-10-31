import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { MetodoConsolidacion } from '../generated/prisma/client';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export class SoftwareDto {
  @Transform(trim)
  @IsString()
  @Length(1, 150)
  nombre!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  version?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  licencia?: string;
}

export class CrearProyectoDto {
  @Transform(trim)
  @IsString()
  @Length(2, 150)
  nombre!: string;

  @Matches(FECHA)
  @IsDateString({ strict: true })
  fechaInicio!: string;

  @IsOptional()
  @Matches(FECHA)
  @IsDateString({ strict: true })
  fechaFin?: string;

  @IsEnum(MetodoConsolidacion)
  metodoConsolidacion!: MetodoConsolidacion;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsInt({ each: true })
  idDimensiones!: number[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SoftwareDto)
  softwares!: SoftwareDto[];
}

export class ActualizarProyectoDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 150)
  nombre?: string;

  /** null removes the end date. */
  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @Matches(FECHA)
  @IsDateString({ strict: true })
  fechaFin?: string | null;

  @IsOptional()
  @IsEnum(MetodoConsolidacion)
  metodoConsolidacion?: MetodoConsolidacion;
}

export class CambiarEstadoDto {
  @IsIn(['en_curso', 'cerrado'])
  estado!: 'en_curso' | 'cerrado';
}

export class AgregarJuradoDto {
  @IsInt()
  idUsuario!: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsInt({ each: true })
  idDimensiones?: number[];
}

export class ActualizarJuradoDto {
  @IsOptional()
  @IsIn(['finalizado'])
  estado?: 'finalizado';

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsInt({ each: true })
  idDimensiones?: number[];
}
