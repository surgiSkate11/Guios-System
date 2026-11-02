import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { UsuarioPublico } from '../auth/usuario-publico';
import {
  Prisma,
  type EstadoJurado,
  type EstadoProyecto,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccesoService } from './acceso.service';
import type {
  ActualizarJuradoDto,
  ActualizarProyectoDto,
  AgregarJuradoDto,
  CrearProyectoDto,
  SoftwareDto,
} from './dto';

const INCLUDE = {
  organizacion: { select: { id: true, nombre: true } },
  coordinador: { select: { id: true, nombre: true, email: true } },
  catalogoVersion: { select: { numero: true } },
  softwares: { orderBy: { id: 'asc' } },
  dimensiones: {
    include: { dimension: true },
    orderBy: { idDimension: 'asc' },
  },
  jurados: {
    orderBy: { id: 'asc' },
    include: {
      usuario: { select: { nombre: true, email: true } },
      dimensiones: {
        select: { idDimension: true },
        orderBy: { idDimension: 'asc' },
      },
    },
  },
} satisfies Prisma.ProyectoEvaluacionInclude;

type ProyectoCompleto = Prisma.ProyectoEvaluacionGetPayload<{
  include: typeof INCLUDE;
}>;

export interface ProyectoResumen {
  id: number;
  nombre: string;
  estado: EstadoProyecto;
  metodoConsolidacion: string;
  fechaInicio: string;
  fechaFin: string | null;
  versionCatalogo: number;
  organizacion: { id: number; nombre: string };
  coordinador: { id: number; nombre: string; email: string };
  softwares: {
    id: number;
    nombre: string;
    version: string | null;
    licencia: string | null;
  }[];
  jurados: {
    idUsuario: number;
    nombre: string;
    email: string;
    estado: EstadoJurado;
    idDimensiones: number[];
  }[];
  dimensiones: { id: number; nombre: string }[];
  miRol: 'coordinador' | 'jurado';
  miEstadoJurado: EstadoJurado | null;
}

const YA_ES_JURADO = 'El usuario ya es jurado del proyecto';

const fecha = (valor: Date) => valor.toISOString().slice(0, 10);

function toResumen(p: ProyectoCompleto, idUsuario: number): ProyectoResumen {
  const mio = p.jurados.find((j) => j.idUsuario === idUsuario);
  return {
    id: p.id,
    nombre: p.nombre,
    estado: p.estado,
    metodoConsolidacion: p.metodoConsolidacion,
    fechaInicio: fecha(p.fechaInicio),
    fechaFin: p.fechaFin ? fecha(p.fechaFin) : null,
    versionCatalogo: p.catalogoVersion.numero,
    organizacion: p.organizacion,
    coordinador: p.coordinador,
    softwares: p.softwares.map(({ id, nombre, version, licencia }) => ({
      id,
      nombre,
      version,
      licencia,
    })),
    jurados: p.jurados.map((j) => ({
      idUsuario: j.idUsuario,
      nombre: j.usuario.nombre,
      email: j.usuario.email,
      estado: j.estado,
      idDimensiones: j.dimensiones.map((d) => d.idDimension),
    })),
    dimensiones: p.dimensiones.map((d) => ({
      id: d.dimension.id,
      nombre: d.dimension.nombre,
    })),
    miRol: p.idCoordinador === idUsuario ? 'coordinador' : 'jurado',
    miEstadoJurado: mio?.estado ?? null,
  };
}

/** Projects, candidate software and judges (RF-02, RF-03, RF-17, RF-21). */
@Injectable()
export class ProyectosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: AccesoService,
  ) {}

  async resumen(
    idProyecto: number,
    usuario: UsuarioPublico,
  ): Promise<ProyectoResumen> {
    const proyecto = await this.prisma.proyectoEvaluacion.findUniqueOrThrow({
      where: { id: idProyecto },
      include: INCLUDE,
    });
    return toResumen(proyecto, usuario.id);
  }

  async listar(
    usuario: UsuarioPublico,
    estado?: EstadoProyecto,
  ): Promise<ProyectoResumen[]> {
    if (usuario.rol === 'administrador') return [];
    const proyectos = await this.prisma.proyectoEvaluacion.findMany({
      where: {
        estado,
        OR: [
          { idCoordinador: usuario.id },
          { jurados: { some: { idUsuario: usuario.id } } },
        ],
      },
      include: INCLUDE,
      orderBy: { id: 'desc' },
    });
    return proyectos.map((p) => toResumen(p, usuario.id));
  }

  async solicitudes(usuario: UsuarioPublico): Promise<ProyectoResumen[]> {
    const proyectos = await this.prisma.proyectoEvaluacion.findMany({
      where: {
        jurados: { some: { idUsuario: usuario.id, estado: 'invitado' } },
      },
      include: INCLUDE,
      orderBy: { id: 'desc' },
    });
    return proyectos.map((p) => toResumen(p, usuario.id));
  }

  async crear(
    usuario: UsuarioPublico,
    dto: CrearProyectoDto,
  ): Promise<ProyectoResumen> {
    if (usuario.idOrganizacion === null) {
      throw new ConflictException('Un coordinador necesita una organización');
    }
    if (dto.fechaFin && dto.fechaFin < dto.fechaInicio) {
      throw new BadRequestException(
        'La fecha de fin no puede ser anterior a la de inicio',
      );
    }
    const version = await this.prisma.catalogoVersion.findFirst({
      orderBy: { numero: 'desc' },
    });
    if (!version) throw new ConflictException('No hay un catálogo cargado');

    const dimensiones = await this.prisma.dimension.findMany({
      where: { id: { in: dto.idDimensiones }, idProyecto: null },
    });
    if (dimensiones.length !== dto.idDimensiones.length) {
      throw new BadRequestException('Alguna dimensión no existe');
    }
    const factores = await this.prisma.factor.findMany({
      where: { idDimension: { in: dto.idDimensiones }, activo: true },
      orderBy: { id: 'asc' },
    });

    const creado = await this.prisma.proyectoEvaluacion.create({
      data: {
        nombre: dto.nombre,
        fechaInicio: new Date(dto.fechaInicio),
        fechaFin: dto.fechaFin ? new Date(dto.fechaFin) : null,
        metodoConsolidacion: dto.metodoConsolidacion,
        idOrganizacion: usuario.idOrganizacion,
        idCoordinador: usuario.id,
        idCatalogoVersion: version.id,
        dimensiones: {
          create: dto.idDimensiones.map((idDimension) => ({ idDimension })),
        },
        softwares: { create: dto.softwares.map(normalizarSoftware) },
        factores: {
          create: factores.map((f) => ({
            idFactor: f.id,
            impSugerida: f.sugeridaDefault,
            alcanceEfectivo: f.alcanceDefault,
          })),
        },
      },
    });
    return this.resumen(creado.id, usuario);
  }

  async actualizar(
    id: number,
    usuario: UsuarioPublico,
    dto: ActualizarProyectoDto,
  ): Promise<ProyectoResumen> {
    const acceso = await this.acceso.comoCoordinador(id, usuario);
    this.acceso.exigirAbierto(acceso);
    const fechaFin = dto.fechaFin === undefined ? undefined : dto.fechaFin;
    if (
      fechaFin &&
      fechaFin < acceso.proyecto.fechaInicio.toISOString().slice(0, 10)
    ) {
      throw new BadRequestException(
        'La fecha de fin no puede ser anterior a la de inicio',
      );
    }
    await this.prisma.proyectoEvaluacion.update({
      where: { id },
      data: {
        nombre: dto.nombre,
        metodoConsolidacion: dto.metodoConsolidacion,
        fechaFin:
          fechaFin === undefined
            ? undefined
            : fechaFin
              ? new Date(fechaFin)
              : null,
      },
    });
    return this.resumen(id, usuario);
  }

  async agregarSoftware(id: number, usuario: UsuarioPublico, dto: SoftwareDto) {
    const acceso = await this.acceso.comoCoordinador(id, usuario);
    this.acceso.exigirAbierto(acceso);
    await this.prisma.softwareCandidato.create({
      data: { idProyecto: id, ...normalizarSoftware(dto) },
    });
    return this.resumen(id, usuario);
  }

  async quitarSoftware(
    id: number,
    idSoftware: number,
    usuario: UsuarioPublico,
  ) {
    const acceso = await this.acceso.comoCoordinador(id, usuario);
    this.acceso.exigirAbierto(acceso);
    if (acceso.proyecto.estado !== 'borrador') {
      throw new ConflictException(
        'Solo se puede quitar un software en borrador',
      );
    }
    const { count } = await this.prisma.softwareCandidato.deleteMany({
      where: { id: idSoftware, idProyecto: id },
    });
    if (count === 0) throw new NotFoundException('Software no encontrado');
    return this.resumen(id, usuario);
  }

  async cambiarEstado(
    id: number,
    usuario: UsuarioPublico,
    estado: 'en_curso' | 'cerrado',
  ) {
    const acceso = await this.acceso.comoCoordinador(id, usuario);
    this.acceso.exigirAbierto(acceso);
    const actual = acceso.proyecto.estado;
    if (estado === 'en_curso' && actual === 'borrador') {
      const [softwares, jurados] = await Promise.all([
        this.prisma.softwareCandidato.count({ where: { idProyecto: id } }),
        this.prisma.juradoProyecto.count({ where: { idProyecto: id } }),
      ]);
      if (softwares === 0)
        throw new ConflictException(
          'El proyecto necesita al menos un software',
        );
      if (jurados === 0)
        throw new ConflictException('El proyecto necesita al menos un jurado');
    } else if (estado === 'cerrado' && actual === 'en_curso') {
      const informes = await this.prisma.informeEvaluacion.count({
        where: { idProyecto: id },
      });
      if (informes === 0)
        throw new ConflictException('Genera los resultados antes de cerrar');
    } else {
      throw new ConflictException('Transición de estado no permitida');
    }
    await this.prisma.proyectoEvaluacion.update({
      where: { id },
      data: { estado },
    });
    return this.resumen(id, usuario);
  }

  async buscarUsuario(email: string) {
    const usuario = await this.prisma.usuario.findFirst({
      where: {
        email: email.trim().toLowerCase(),
        activo: true,
        rol: { not: 'administrador' },
      },
      select: { id: true, nombre: true, email: true },
    });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    return usuario;
  }

  async agregarJurado(
    id: number,
    usuario: UsuarioPublico,
    dto: AgregarJuradoDto,
  ) {
    const acceso = await this.acceso.comoCoordinador(id, usuario);
    this.acceso.exigirAbierto(acceso);
    const candidato = await this.prisma.usuario.findFirst({
      where: { id: dto.idUsuario, activo: true, rol: { not: 'administrador' } },
    });
    if (!candidato) throw new NotFoundException('Usuario no encontrado');
    const idDimensiones = await this.dimensionesDelProyecto(
      id,
      dto.idDimensiones,
    );
    const existente = await this.prisma.juradoProyecto.findUnique({
      where: {
        idProyecto_idUsuario: { idProyecto: id, idUsuario: dto.idUsuario },
      },
    });
    if (existente) throw new ConflictException(YA_ES_JURADO);
    try {
      await this.prisma.juradoProyecto.create({
        data: {
          idProyecto: id,
          idUsuario: dto.idUsuario,
          // The coordinator judging their own project needs no invitation (RF-21).
          estado: dto.idUsuario === usuario.id ? 'activo' : 'invitado',
          dimensiones: {
            create: idDimensiones.map((idDimension) => ({ idDimension })),
          },
        },
      });
    } catch (error) {
      // A concurrent invitation won the race: the unique index is the real guard.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(YA_ES_JURADO);
      }
      throw error;
    }
    return this.resumen(id, usuario);
  }

  async actualizarJurado(
    id: number,
    idUsuario: number,
    usuario: UsuarioPublico,
    dto: ActualizarJuradoDto,
  ) {
    const acceso = await this.acceso.comoCoordinador(id, usuario);
    this.acceso.exigirAbierto(acceso);
    const jurado = await this.juradoDe(id, idUsuario);
    const idDimensiones = dto.idDimensiones
      ? await this.dimensionesDelProyecto(id, dto.idDimensiones)
      : undefined;
    await this.prisma.juradoProyecto.update({
      where: { id: jurado.id },
      data: {
        estado: dto.estado,
        dimensiones: idDimensiones
          ? {
              deleteMany: {},
              create: idDimensiones.map((idDimension) => ({ idDimension })),
            }
          : undefined,
      },
    });
    return this.resumen(id, usuario);
  }

  async quitarJurado(id: number, idUsuario: number, usuario: UsuarioPublico) {
    const acceso = await this.acceso.comoCoordinador(id, usuario);
    this.acceso.exigirAbierto(acceso);
    const jurado = await this.juradoDe(id, idUsuario);
    const [importancias, calificaciones] = await Promise.all([
      this.prisma.juradoImportancia.count({
        where: { idUsuario, proyectoFactor: { idProyecto: id } },
      }),
      this.prisma.evaluacionSubfactor.count({
        where: { idUsuario, software: { idProyecto: id } },
      }),
    ]);
    if (importancias + calificaciones > 0) {
      throw new ConflictException('El jurado ya registró respuestas');
    }
    await this.prisma.juradoProyecto.delete({ where: { id: jurado.id } });
    return this.resumen(id, usuario);
  }

  async responderSolicitud(
    id: number,
    usuario: UsuarioPublico,
    acepta: boolean,
  ) {
    const acceso = await this.acceso.obtener(id, usuario);
    this.acceso.exigirAbierto(acceso);
    if (acceso.jurado?.estado !== 'invitado') {
      throw new ConflictException('No hay una solicitud pendiente');
    }
    if (acepta) {
      await this.prisma.juradoProyecto.update({
        where: { id: acceso.jurado.id },
        data: { estado: 'activo' },
      });
      return this.resumen(id, usuario);
    }
    await this.prisma.juradoProyecto.delete({
      where: { id: acceso.jurado.id },
    });
    return null;
  }

  private async juradoDe(idProyecto: number, idUsuario: number) {
    const jurado = await this.prisma.juradoProyecto.findUnique({
      where: { idProyecto_idUsuario: { idProyecto, idUsuario } },
    });
    if (!jurado) throw new NotFoundException('Jurado no encontrado');
    return jurado;
  }

  /** Requested dimensions must belong to the project; none means all of them. */
  private async dimensionesDelProyecto(idProyecto: number, pedidas?: number[]) {
    const propias = (
      await this.prisma.proyectoDimension.findMany({ where: { idProyecto } })
    ).map((d) => d.idDimension);
    if (!pedidas) return propias;
    if (pedidas.some((id) => !propias.includes(id))) {
      throw new BadRequestException(
        'Alguna dimensión no pertenece al proyecto',
      );
    }
    return pedidas;
  }
}

function normalizarSoftware(dto: SoftwareDto) {
  return {
    nombre: dto.nombre,
    version: dto.version ?? null,
    licencia: dto.licencia ?? null,
  };
}
