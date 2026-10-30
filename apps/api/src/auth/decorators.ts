import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { Rol } from '../generated/prisma/client';
import type { UsuarioPublico } from './usuario-publico';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';

/** Opens a route to unauthenticated requests. Every other route requires a valid token. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Restricts a route to the given global roles (checked on the server, RNF-08). */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);

/** Injects the authenticated user loaded by JwtAuthGuard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): UsuarioPublico =>
    context.switchToHttp().getRequest<{ user: UsuarioPublico }>().user,
);
