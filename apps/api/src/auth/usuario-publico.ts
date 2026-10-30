import type { Rol, Usuario } from '../generated/prisma/client';

/** User data safe to send to clients: never includes the password hash. */
export interface UsuarioPublico {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
  idOrganizacion: number | null;
}

export function toUsuarioPublico(usuario: Usuario): UsuarioPublico {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol,
    idOrganizacion: usuario.idOrganizacion,
  };
}
