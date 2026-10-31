import {
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
} from '@nestjs/common';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  ValidateIf,
} from 'class-validator';
import { CurrentUser, Roles } from '../auth/decorators';
import type { UsuarioPublico } from '../auth/usuario-publico';
import { Rol, type Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

class ActualizarUsuarioDto {
  @IsOptional()
  @IsEnum(Rol)
  rol?: Rol;

  /** null removes the organization. */
  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @IsInt()
  idOrganizacion?: number | null;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export interface UsuarioAdmin extends UsuarioPublico {
  activo: boolean;
  organizacion: { id: number; nombre: string } | null;
}

const SELECT = {
  id: true,
  nombre: true,
  email: true,
  rol: true,
  activo: true,
  idOrganizacion: true,
  organizacion: { select: { id: true, nombre: true } },
} satisfies Prisma.UsuarioSelect;

/** User administration (RF-01): roles, organization and activation. */
@Controller('usuarios')
@Roles('administrador')
export class UsuariosController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  listar(): Promise<UsuarioAdmin[]> {
    return this.prisma.usuario.findMany({
      select: SELECT,
      orderBy: { id: 'asc' },
    });
  }

  @Patch(':id')
  async actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ActualizarUsuarioDto,
    @CurrentUser() actual: UsuarioPublico,
  ): Promise<UsuarioAdmin> {
    const usuario = await this.prisma.usuario.findUnique({ where: { id } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    const cambiaPropiaCuenta =
      id === actual.id &&
      ((body.rol !== undefined && body.rol !== 'administrador') ||
        body.activo === false);
    if (cambiaPropiaCuenta) {
      throw new ConflictException(
        'No puedes modificar tu propia cuenta de administrador',
      );
    }

    const idOrganizacion =
      body.idOrganizacion === undefined
        ? usuario.idOrganizacion
        : body.idOrganizacion;
    if (body.idOrganizacion != null) {
      const org = await this.prisma.organizacion.findUnique({
        where: { id: body.idOrganizacion },
      });
      if (!org) throw new NotFoundException('Organización no encontrada');
      if (!org.activo)
        throw new ConflictException('La organización está inactiva');
    }
    const rol = body.rol ?? usuario.rol;
    if (rol === 'coordinador' && idOrganizacion === null) {
      throw new ConflictException('Un coordinador necesita una organización');
    }

    return this.prisma.usuario.update({
      where: { id },
      data: { rol, idOrganizacion, activo: body.activo },
      select: SELECT,
    });
  }
}
