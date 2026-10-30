import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { AuthService, type SesionRespuesta } from './auth.service';
import { CurrentUser, Public } from './decorators';
import { LoginDto, RegistroDto } from './dto';
import type { UsuarioPublico } from './usuario-publico';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() body: LoginDto): Promise<SesionRespuesta> {
    return this.auth.login(body);
  }

  @Public()
  @Post('registro')
  registro(@Body() body: RegistroDto): Promise<SesionRespuesta> {
    return this.auth.registro(body);
  }

  @Get('me')
  me(@CurrentUser() usuario: UsuarioPublico): UsuarioPublico {
    return usuario;
  }
}
