import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { UsuarioPublico } from '../auth/usuario-publico';
import type {
  JuradoProyecto,
  ProyectoEvaluacion,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AccesoProyecto {
  proyecto: ProyectoEvaluacion;
  esCoordinador: boolean;
  /** My judge row in this project, if any. */
  jurado: (JuradoProyecto & { idDimensiones: number[] }) | null;
}

export const PROYECTO_CERRADO = 'El proyecto está cerrado';

/**
 * Project-level access (RNF-08). A project is visible to its coordinator and to its judges;
 * anybody else, administrators included, gets a 404 so the project's existence never leaks.
 */
@Injectable()
export class AccesoService {
  constructor(private readonly prisma: PrismaService) {}

  async obtener(
    idProyecto: number,
    usuario: UsuarioPublico,
  ): Promise<AccesoProyecto> {
    const noEncontrado = new NotFoundException('Proyecto no encontrado');
    if (usuario.rol === 'administrador') throw noEncontrado;
    const proyecto = await this.prisma.proyectoEvaluacion.findUnique({
      where: { id: idProyecto },
      include: {
        jurados: {
          where: { idUsuario: usuario.id },
          include: { dimensiones: { select: { idDimension: true } } },
        },
      },
    });
    if (!proyecto) throw noEncontrado;
    const { jurados, ...datos } = proyecto;
    const fila = jurados[0];
    const esCoordinador = proyecto.idCoordinador === usuario.id;
    if (!esCoordinador && !fila) throw noEncontrado;
    const jurado = fila
      ? {
          id: fila.id,
          idProyecto: fila.idProyecto,
          idUsuario: fila.idUsuario,
          estado: fila.estado,
          idDimensiones: fila.dimensiones.map((d) => d.idDimension),
        }
      : null;
    return { proyecto: datos, esCoordinador, jurado };
  }

  /** Access as the project's coordinator; judges get 403. */
  async comoCoordinador(
    idProyecto: number,
    usuario: UsuarioPublico,
  ): Promise<AccesoProyecto> {
    const acceso = await this.obtener(idProyecto, usuario);
    if (!acceso.esCoordinador) {
      throw new ForbiddenException(
        'Solo el coordinador del proyecto puede hacerlo',
      );
    }
    return acceso;
  }

  /** Access as an active judge; anyone else with access gets 403. */
  async comoJuradoActivo(
    idProyecto: number,
    usuario: UsuarioPublico,
  ): Promise<AccesoProyecto> {
    const acceso = await this.obtener(idProyecto, usuario);
    if (acceso.jurado?.estado !== 'activo') {
      throw new ForbiddenException(
        'Solo un jurado activo del proyecto puede hacerlo',
      );
    }
    return acceso;
  }

  /** RNF-09: a closed project is immutable. */
  exigirAbierto(acceso: AccesoProyecto): void {
    if (acceso.proyecto.estado === 'cerrado')
      throw new ConflictException(PROYECTO_CERRADO);
  }

  /** Answers are only recorded while the project runs. */
  exigirEnCurso(acceso: AccesoProyecto): void {
    this.exigirAbierto(acceso);
    if (acceso.proyecto.estado !== 'en_curso') {
      throw new ConflictException('El proyecto todavía no está en curso');
    }
  }
}
