import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { resetDatabase } from './reset-database';

/** Integrity rules of spec section 9, enforced by the database itself. */
describe('data model integrity (e2e, test database)', () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  let ids: {
    usuario: number;
    version: number;
    factor: number;
    subfactor: number;
    proyecto: number;
    software: number;
    proyectoFactor: number;
  };

  beforeEach(async () => {
    await resetDatabase(prisma);
    const organizacion = await prisma.organizacion.create({
      data: { nombre: 'NovaTech', sector: 'privado' },
    });
    const usuario = await prisma.usuario.create({
      data: {
        nombre: 'Coordinadora',
        email: 'coord@novatech.com',
        passwordHash: 'x',
        rol: 'coordinador',
        idOrganizacion: organizacion.id,
      },
    });
    const version = await prisma.catalogoVersion.create({
      data: {
        numero: 1,
        motivo: 'Catálogo de la tesis',
        rq1: 1.86,
        rq2: 3.65,
        rq3: 4.78,
      },
    });
    const dimension = await prisma.dimension.create({
      data: { nombre: 'Tecnológica' },
    });
    const factor = await prisma.factor.create({
      data: {
        idDimension: dimension.id,
        nombre: 'Documentación',
        sugeridaDefault: 3,
        alcanceDefault: 'externo',
        origen: 'tesis',
      },
    });
    const subfactor = await prisma.subfactor.create({
      data: { idFactor: factor.id, texto: 'Manual de usuario en línea' },
    });
    const proyecto = await prisma.proyectoEvaluacion.create({
      data: {
        idOrganizacion: organizacion.id,
        idCoordinador: usuario.id,
        nombre: 'Sistema de inventario',
        fechaInicio: new Date('2026-10-01'),
        idCatalogoVersion: version.id,
      },
    });
    const software = await prisma.softwareCandidato.create({
      data: { idProyecto: proyecto.id, nombre: 'Odoo', licencia: 'LGPL-3.0' },
    });
    const proyectoFactor = await prisma.proyectoFactor.create({
      data: {
        idProyecto: proyecto.id,
        idFactor: factor.id,
        impSugerida: 3,
        alcanceEfectivo: 'externo',
      },
    });
    ids = {
      usuario: usuario.id,
      version: version.id,
      factor: factor.id,
      subfactor: subfactor.id,
      proyecto: proyecto.id,
      software: software.id,
      proyectoFactor: proyectoFactor.id,
    };
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await prisma.$disconnect();
  });

  describe('evaluacion_subfactor: Desconozco with null value, or a value 1-4', () => {
    const base = () => ({
      idSoftware: ids.software,
      idUsuario: ids.usuario,
      idSubfactor: ids.subfactor,
    });

    it('accepts a value from 1 to 4', async () => {
      await expect(
        prisma.evaluacionSubfactor.create({ data: { ...base(), valor: 4 } }),
      ).resolves.toMatchObject({ valor: 4, desconozco: false });
    });

    it('accepts Desconozco with a null value', async () => {
      await expect(
        prisma.evaluacionSubfactor.create({
          data: { ...base(), desconozco: true },
        }),
      ).resolves.toMatchObject({ valor: null, desconozco: true });
    });

    it.each([
      [{ desconozco: true, valor: 3 }],
      [{ desconozco: false }],
      [{ valor: 0 }],
      [{ valor: 5 }],
    ])('rejects %j', async (data) => {
      await expect(
        prisma.evaluacionSubfactor.create({ data: { ...base(), ...data } }),
      ).rejects.toThrow();
      expect(await prisma.evaluacionSubfactor.count()).toBe(0);
    });

    it('keeps one answer per judge, software and subfactor', async () => {
      await prisma.evaluacionSubfactor.create({
        data: { ...base(), valor: 2 },
      });
      await expect(
        prisma.evaluacionSubfactor.create({ data: { ...base(), valor: 3 } }),
      ).rejects.toThrow();
    });
  });

  describe('factor', () => {
    it('rejects a 2020-2025 literature factor marked as validated by experts', async () => {
      const factor = await prisma.factor.findUniqueOrThrow({
        where: { id: ids.factor },
      });
      await expect(
        prisma.factor.create({
          data: {
            idDimension: factor.idDimension,
            nombre: 'Integración con modelos de IA',
            sugeridaDefault: 3,
            alcanceDefault: 'externo',
            origen: 'lit_2020_2025',
            validadoExpertos: true,
          },
        }),
      ).rejects.toThrow();
    });

    it('rejects a suggested importance outside 1-4', async () => {
      await expect(
        prisma.factor.update({
          where: { id: ids.factor },
          data: { sugeridaDefault: 5 },
        }),
      ).rejects.toThrow();
    });
  });

  describe('proyecto_evaluacion', () => {
    it('rejects an end date before the start date', async () => {
      await expect(
        prisma.proyectoEvaluacion.update({
          where: { id: ids.proyecto },
          data: { fechaFin: new Date('2026-09-30') },
        }),
      ).rejects.toThrow();
    });

    it('accepts an end date equal to the start date', async () => {
      await expect(
        prisma.proyectoEvaluacion.update({
          where: { id: ids.proyecto },
          data: { fechaFin: new Date('2026-10-01') },
        }),
      ).resolves.toBeDefined();
    });
  });

  describe('estimacion_is', () => {
    it('rejects an approval without recording who approved it', async () => {
      await expect(
        prisma.estimacionIs.create({
          data: {
            idFactor: ids.factor,
            modo: 'ia',
            estado: 'aprobada',
            isPropuesta: 3,
            isAprobada: 3,
          },
        }),
      ).rejects.toThrow();
    });

    it('requires a justification when the approved IS differs from the proposal', async () => {
      const data = {
        idFactor: ids.factor,
        modo: 'manual' as const,
        estado: 'aprobada' as const,
        isPropuesta: 2,
        isAprobada: 3,
        aprobadoPorId: ids.usuario,
      };
      await expect(prisma.estimacionIs.create({ data })).rejects.toThrow();
      await expect(
        prisma.estimacionIs.create({
          data: { ...data, justificacion: 'Evidencia nueva' },
        }),
      ).resolves.toBeDefined();
    });
  });

  describe('importance ranges', () => {
    it('rejects a judge importance outside 1-4', async () => {
      await expect(
        prisma.juradoImportancia.create({
          data: {
            idProyectoFactor: ids.proyectoFactor,
            idUsuario: ids.usuario,
            impDecisor: 0,
          },
        }),
      ).rejects.toThrow();
    });

    it('rejects evidence outside 2020-2025', async () => {
      await expect(
        prisma.evidenciaLiteratura.create({
          data: {
            idFactor: ids.factor,
            idSubfactor: ids.subfactor,
            referencia: 'Artículo de 2019',
            anio: 2019,
            tipoPublicacion: 'articulo_revisado',
            fuente: 'manual',
          },
        }),
      ).rejects.toThrow();
    });
  });
});
