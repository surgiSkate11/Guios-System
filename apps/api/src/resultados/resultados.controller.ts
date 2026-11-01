import { Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators';
import type { UsuarioPublico } from '../auth/usuario-publico';
import { ResultadosService } from './resultados.service';

@Controller('proyectos/:id')
export class ResultadosController {
  constructor(private readonly resultados: ResultadosService) {}

  @Get('resultados/vista-previa')
  vistaPrevia(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() u: UsuarioPublico,
  ) {
    return this.resultados.vistaPrevia(id, u);
  }

  @Post('resultados')
  generar(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() u: UsuarioPublico,
  ) {
    return this.resultados.generar(id, u);
  }

  @Get('resultados')
  ultimo(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() u: UsuarioPublico,
  ) {
    return this.resultados.ultimo(id, u);
  }

  @Get('resultados/mio')
  mio(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: UsuarioPublico) {
    return this.resultados.mio(id, u);
  }

  @Get('auditoria')
  auditoria(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() u: UsuarioPublico,
  ) {
    return this.resultados.auditoria(id, u);
  }
}
