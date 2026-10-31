import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { Roles } from '../auth/decorators';
import { Sector, type Organizacion } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

class CrearOrganizacionDto {
  @Transform(trim)
  @IsString()
  @Length(2, 150)
  nombre!: string;

  @IsEnum(Sector)
  sector!: Sector;
}

class ActualizarOrganizacionDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 150)
  nombre?: string;

  @IsOptional()
  @IsEnum(Sector)
  sector?: Sector;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

type OrganizacionPublica = Pick<
  Organizacion,
  'id' | 'nombre' | 'sector' | 'activo'
>;

const SELECT = { id: true, nombre: true, sector: true, activo: true } as const;

/** Organizations (RF-01). Managed only by administrators. */
@Controller('organizaciones')
@Roles('administrador')
export class OrganizacionesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  listar(): Promise<OrganizacionPublica[]> {
    return this.prisma.organizacion.findMany({
      select: SELECT,
      orderBy: { nombre: 'asc' },
    });
  }

  @Post()
  crear(@Body() body: CrearOrganizacionDto): Promise<OrganizacionPublica> {
    return this.prisma.organizacion.create({ data: body, select: SELECT });
  }

  @Patch(':id')
  async actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ActualizarOrganizacionDto,
  ): Promise<OrganizacionPublica> {
    const existe = await this.prisma.organizacion.findUnique({ where: { id } });
    if (!existe) throw new NotFoundException('Organización no encontrada');
    return this.prisma.organizacion.update({
      where: { id },
      data: body,
      select: SELECT,
    });
  }
}
