import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthService, type SesionRespuesta } from './auth.service';
import { CurrentUser, Public } from './decorators';
import { LoginDto, RecuperarDto, RegistroDto, RestablecerDto } from './dto';
import { RecuperacionService } from './recuperacion.service';
import type { UsuarioPublico } from './usuario-publico';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly recuperacion: RecuperacionService,
  ) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() body: LoginDto): Promise<SesionRespuesta> {
    return this.auth.login(body);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('registro')
  registro(@Body() body: RegistroDto): Promise<SesionRespuesta> {
    return this.auth.registro(body);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('recuperar')
  @HttpCode(HttpStatus.NO_CONTENT)
  async recuperar(@Body() body: RecuperarDto): Promise<void> {
    await this.recuperacion.solicitar(body.email);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('restablecer')
  @HttpCode(HttpStatus.NO_CONTENT)
  async restablecer(@Body() body: RestablecerDto): Promise<void> {
    await this.recuperacion.restablecer(body.token, body.password);
  }

  @Get('me')
  me(@CurrentUser() usuario: UsuarioPublico): UsuarioPublico {
    return usuario;
  }
}
