import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CurrentUser, Roles } from '../auth/decorators';
import type { UsuarioPublico } from '../auth/usuario-publico';
import { MedicionAnclasService } from './medicion-anclas.service';

/**
 * A11. Anchor measurement (section 6, `medicion_ancla`).
 *
 * The anchors are the catalog's own factors, measured again with the same
 * method used for a new factor, so their r values locate the cuts (rq1, rq2,
 * rq3) that turn a new factor's r into an IL. Measuring publishes a new
 * catalog version, which is why it is restricted to the administrator.
 */
@Controller('catalogo/anclas')
@Roles('administrador')
export class MedicionAnclasController {
  constructor(private readonly anclas: MedicionAnclasService) {}

  /** Last measurement (or the anchors of the current version) for the screen. */
  @Get()
  estado() {
    return this.anclas.estado();
  }

  /** Starts the measurement in the background; the screen polls the GET. */
  @Post('medir')
  @HttpCode(HttpStatus.ACCEPTED)
  medir(@CurrentUser() admin: UsuarioPublico) {
    return this.anclas.medir(admin);
  }
}
