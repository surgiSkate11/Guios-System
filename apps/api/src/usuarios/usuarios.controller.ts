import { Controller, Get } from '@nestjs/common';
import { Roles } from '../auth/decorators';
import { toUsuarioPublico, type UsuarioPublico } from '../auth/usuario-publico';
import { PrismaService } from '../prisma/prisma.service';

/** User administration (RF-01). Only administrators manage accounts. */
@Controller('usuarios')
@Roles('administrador')
export class UsuariosController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async listar(): Promise<UsuarioPublico[]> {
    const usuarios = await this.prisma.usuario.findMany({
      orderBy: { id: 'asc' },
    });
    return usuarios.map(toUsuarioPublico);
  }
}
