import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser, Roles } from '../auth/decorators';
import type { UsuarioPublico } from '../auth/usuario-publico';
import { EstadoProyecto } from '../generated/prisma/client';
import { AccesoService } from './acceso.service';
import {
  ActualizarJuradoDto,
  ActualizarProyectoDto,
  AgregarJuradoDto,
  CambiarEstadoDto,
  CrearProyectoDto,
  SoftwareDto,
} from './dto';
import { ProyectosService, type ProyectoResumen } from './proyectos.service';

@Controller('proyectos')
export class ProyectosController {
  constructor(
    private readonly proyectos: ProyectosService,
    private readonly acceso: AccesoService,
  ) {}

  @Get()
  listar(
    @CurrentUser() usuario: UsuarioPublico,
    @Query('estado', new ParseEnumPipe(EstadoProyecto, { optional: true }))
    estado?: EstadoProyecto,
  ): Promise<ProyectoResumen[]> {
    return this.proyectos.listar(usuario, estado);
  }

  @Post()
  @Roles('coordinador')
  crear(
    @CurrentUser() usuario: UsuarioPublico,
    @Body() body: CrearProyectoDto,
  ) {
    return this.proyectos.crear(usuario, body);
  }

  @Get(':id')
  async obtener(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: UsuarioPublico,
  ) {
    await this.acceso.obtener(id, usuario);
    return this.proyectos.resumen(id, usuario);
  }

  @Patch(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: UsuarioPublico,
    @Body() body: ActualizarProyectoDto,
  ) {
    return this.proyectos.actualizar(id, usuario, body);
  }

  @Post(':id/softwares')
  agregarSoftware(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: UsuarioPublico,
    @Body() body: SoftwareDto,
  ) {
    return this.proyectos.agregarSoftware(id, usuario, body);
  }

  @Delete(':id/softwares/:idSoftware')
  quitarSoftware(
    @Param('id', ParseIntPipe) id: number,
    @Param('idSoftware', ParseIntPipe) idSoftware: number,
    @CurrentUser() usuario: UsuarioPublico,
  ) {
    return this.proyectos.quitarSoftware(id, idSoftware, usuario);
  }

  @Post(':id/estado')
  @HttpCode(HttpStatus.OK)
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: UsuarioPublico,
    @Body() body: CambiarEstadoDto,
  ) {
    return this.proyectos.cambiarEstado(id, usuario, body.estado);
  }

  @Post(':id/jurados')
  agregarJurado(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: UsuarioPublico,
    @Body() body: AgregarJuradoDto,
  ) {
    return this.proyectos.agregarJurado(id, usuario, body);
  }

  @Patch(':id/jurados/:idUsuario')
  actualizarJurado(
    @Param('id', ParseIntPipe) id: number,
    @Param('idUsuario', ParseIntPipe) idUsuario: number,
    @CurrentUser() usuario: UsuarioPublico,
    @Body() body: ActualizarJuradoDto,
  ) {
    return this.proyectos.actualizarJurado(id, idUsuario, usuario, body);
  }

  @Delete(':id/jurados/:idUsuario')
  quitarJurado(
    @Param('id', ParseIntPipe) id: number,
    @Param('idUsuario', ParseIntPipe) idUsuario: number,
    @CurrentUser() usuario: UsuarioPublico,
  ) {
    return this.proyectos.quitarJurado(id, idUsuario, usuario);
  }

  @Post(':id/solicitud/aceptar')
  @HttpCode(HttpStatus.OK)
  async aceptar(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: UsuarioPublico,
  ) {
    return this.proyectos.responderSolicitud(id, usuario, true);
  }

  @Post(':id/solicitud/rechazar')
  @HttpCode(HttpStatus.NO_CONTENT)
  async rechazar(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: UsuarioPublico,
  ): Promise<void> {
    await this.proyectos.responderSolicitud(id, usuario, false);
  }
}

@Controller()
export class SolicitudesController {
  constructor(private readonly proyectos: ProyectosService) {}

  @Get('solicitudes')
  solicitudes(@CurrentUser() usuario: UsuarioPublico) {
    return this.proyectos.solicitudes(usuario);
  }

  @Get('usuarios/buscar')
  @Roles('coordinador')
  buscar(@Query('email') email = '') {
    return this.proyectos.buscarUsuario(email);
  }
}
