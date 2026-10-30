import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { LoginDto, RegistroDto } from './dto';
import type { JwtPayload } from './jwt-auth.guard';
import { hashPassword, verifyPassword } from './password';
import { toUsuarioPublico, type UsuarioPublico } from './usuario-publico';

export interface SesionRespuesta {
  accessToken: string;
  usuario: UsuarioPublico;
}

const CREDENCIALES_INVALIDAS = 'Credenciales inválidas';
const CORREO_REGISTRADO = 'El correo ya está registrado';

@Injectable()
export class AuthService {
  // Hash checked when the email does not exist, so both failures take similar time.
  private dummyHash?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login({ email, password }: LoginDto): Promise<SesionRespuesta> {
    const usuario = await this.prisma.usuario.findUnique({ where: { email } });
    if (!usuario) {
      this.dummyHash ??= hashPassword('dummy-password-for-timing');
      await verifyPassword(await this.dummyHash, password);
      throw new UnauthorizedException(CREDENCIALES_INVALIDAS);
    }
    const valida = await verifyPassword(usuario.passwordHash, password);
    if (!valida || !usuario.activo)
      throw new UnauthorizedException(CREDENCIALES_INVALIDAS);
    return this.sesion(toUsuarioPublico(usuario));
  }

  /** Self sign-up always creates an invitado (RF-01): the role is never chosen by the user. */
  async registro({
    nombre,
    email,
    password,
  }: RegistroDto): Promise<SesionRespuesta> {
    try {
      const usuario = await this.prisma.usuario.create({
        data: {
          nombre,
          email,
          passwordHash: await hashPassword(password),
          rol: 'invitado',
        },
      });
      return this.sesion(toUsuarioPublico(usuario));
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(CORREO_REGISTRADO);
      }
      throw error;
    }
  }

  private async sesion(usuario: UsuarioPublico): Promise<SesionRespuesta> {
    const payload: JwtPayload = { sub: usuario.id };
    return { accessToken: await this.jwt.signAsync(payload), usuario };
  }
}
