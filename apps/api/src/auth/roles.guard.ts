import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Rol } from '../generated/prisma/client';
import { ROLES_KEY } from './decorators';
import type { UsuarioPublico } from './usuario-publico';

/** Global guard: enforces @Roles(...) after JwtAuthGuard has loaded the user. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Rol[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!roles || roles.length === 0) return true;

    const user = context
      .switchToHttp()
      .getRequest<{ user?: UsuarioPublico }>().user;
    if (!user || !roles.includes(user.rol)) throw new ForbiddenException();
    return true;
  }
}
