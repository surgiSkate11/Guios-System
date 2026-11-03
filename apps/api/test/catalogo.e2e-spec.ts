import {
  cargarCatalogo,
  type CatalogoJson,
} from '../src/catalogo/cargar-catalogo';
import { seedCatalogo } from './fixtures';
import { createTestContext, TestContext } from './helpers';

describe('Catalog A2 (e2e, test database)', () => {
  let t: TestContext;

  beforeAll(async () => {
    t = await createTestContext();
  });
  beforeEach(async () => {
    await t.reset();
  });
  afterAll(async () => {
    await t.reset();
    await t.app.close();
  });

  const json: CatalogoJson = {
    motivo: 'Catálogo validado de la tesis',
    cortes: { rq1: 1.86, rq2: 3.65, rq3: 4.78 },
    dimensiones: [
      {
        nombre: 'Tecnológica',
        factores: [
          {
            nombre: 'Usabilidad',
            sugeridaDefault: 3,
            alcanceDefault: 'externo',
            subfactores: ['Interfaz intuitiva', 'Curva de aprendizaje baja'],
          },
        ],
      },
      {
        nombre: 'Económica',
        factores: [
          {
            nombre: 'Coste total de propiedad',
            sugeridaDefault: 2,
            alcanceDefault: 'interno',
            subfactores: ['Coste de licencias'],
          },
        ],
      },
    ],
  };

  it('answers 404 when there is no catalog yet', async () => {
    const user = await t.usuario('invitado');
    const res = await t
      .http()
      .get('/api/catalogo/vigente')
      .set(user.auth)
      .expect(404);
    expect(res.body.message).toBe('No hay un catálogo cargado');
  });

  it('serves the current version with active dimensions, factors and subfactors', async () => {
    const cat = await seedCatalogo(t.prisma);
    const user = await t.usuario('invitado');
    const res = await t
      .http()
      .get('/api/catalogo/vigente')
      .set(user.auth)
      .expect(200);
    expect(res.body.version).toMatchObject({
      id: cat.version.id,
      numero: 1,
      rq1: 1.86,
      rq2: 3.65,
      rq3: 4.78,
    });
    const tec = res.body.dimensiones.find(
      (d: { nombre: string }) => d.nombre === 'Tecnológica',
    );
    expect(tec.factores.map((f: { nombre: string }) => f.nombre)).toEqual([
      'Usabilidad',
      'Documentación',
    ]);
    expect(tec.factores[0]).toMatchObject({
      sugeridaDefault: 3,
      alcanceDefault: 'externo',
      origen: 'tesis',
      validadoExpertos: false,
      subfactores: [
        { id: expect.any(Number), texto: 'Usabilidad 1' },
        { id: expect.any(Number), texto: 'Usabilidad 2' },
      ],
    });
    const versiones = await t
      .http()
      .get('/api/catalogo/versiones')
      .set(user.auth)
      .expect(200);
    expect(versiones.body).toEqual([
      expect.objectContaining({ numero: 1, motivo: 'Catálogo de prueba' }),
    ]);
  });

  it('requires a session', async () => {
    await t.http().get('/api/catalogo/vigente').expect(401);
  });

  describe('cargarCatalogo (thesis catalog loader)', () => {
    it('loads version 1 with validated thesis factors', async () => {
      const resumen = await cargarCatalogo(t.prisma, json);
      expect(resumen).toEqual({
        creado: true,
        version: 1,
        dimensiones: 2,
        factores: 2,
        subfactores: 3,
      });
      const factor = await t.prisma.factor.findFirstOrThrow({
        where: { nombre: 'Usabilidad' },
        include: { subfactores: true },
      });
      expect(factor).toMatchObject({
        origen: 'tesis',
        isOrigen: 'tesis',
        validadoExpertos: true,
      });
      expect(factor.subfactores.map((s) => s.texto)).toEqual([
        'Interfaz intuitiva',
        'Curva de aprendizaje baja',
      ]);
    });

    it('is idempotent: a second run loads nothing', async () => {
      await cargarCatalogo(t.prisma, json);
      const segunda = await cargarCatalogo(t.prisma, json);
      expect(segunda).toEqual({
        creado: false,
        version: 1,
        dimensiones: 0,
        factores: 0,
        subfactores: 0,
      });
      expect(await t.prisma.factor.count()).toBe(2);
    });

    it.each([
      ['an importance outside 1-4', { sugeridaDefault: 5 }],
      ['an unknown scope', { alcanceDefault: 'mixto' }],
      ['a factor without subfactors', { subfactores: [] }],
      [
        'a subfactor longer than 300 characters',
        { subfactores: ['x'.repeat(301)] },
      ],
    ])('rejects %s and writes nothing', async (_caso, cambio) => {
      const malo = structuredClone(json) as unknown as {
        dimensiones: { factores: Record<string, unknown>[] }[];
      };
      Object.assign(malo.dimensiones[0].factores[0], cambio);
      await expect(
        cargarCatalogo(t.prisma, malo as unknown as CatalogoJson),
      ).rejects.toThrow();
      expect(await t.prisma.catalogoVersion.count()).toBe(0);
      expect(await t.prisma.factor.count()).toBe(0);
    });
  });
});
