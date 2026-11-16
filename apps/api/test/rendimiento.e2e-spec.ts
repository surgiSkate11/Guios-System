import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cargarCatalogo, type CatalogoJson } from '../src/catalogo/cargar-catalogo';
import { crearOrganizacion } from './fixtures';
import { createTestContext, TestContext } from './helpers';

/**
 * RNF-04: recomputing a project with five software and ten judges takes less than two seconds.
 * Uses the full thesis catalog (18 factors, 61 subfactors). Answers are inserted directly so
 * only the measured operation goes through HTTP.
 */
describe('Performance RNF-04 (e2e, test database)', () => {
  let t: TestContext;
  const LIMITE_MS = 2000;

  beforeAll(async () => {
    t = await createTestContext();
  });
  afterAll(async () => {
    await t.reset();
    await t.app.close();
  });

  it('generates the results of 5 software x 10 judges in under 2 s', async () => {
    await t.reset();
    const json = JSON.parse(
      readFileSync(join(__dirname, '..', 'prisma', 'catalogo.json'), 'utf8'),
    ) as CatalogoJson;
    await cargarCatalogo(t.prisma, json);
    const org = await crearOrganizacion(t.prisma);
    const coord = await t.usuario('coordinador', { idOrganizacion: org.id });
    const jurados = await Promise.all(
      Array.from({ length: 10 }, (_, i) => t.usuario('invitado', { nombre: `Jurado ${i + 1}` })),
    );
    const version = await t.prisma.catalogoVersion.findFirstOrThrow();
    const dimensiones = await t.prisma.dimension.findMany({ where: { idProyecto: null } });
    const factores = await t.prisma.factor.findMany({
      where: { activo: true },
      include: { subfactores: { where: { activo: true } } },
    });
    expect(factores).toHaveLength(18);

    const proyecto = await t.prisma.proyectoEvaluacion.create({
      data: {
        nombre: 'Carga RNF-04',
        fechaInicio: new Date('2026-11-01'),
        estado: 'en_curso',
        idOrganizacion: org.id,
        idCoordinador: coord.id,
        idCatalogoVersion: version.id,
        dimensiones: { create: dimensiones.map((d) => ({ idDimension: d.id })) },
        softwares: {
          create: Array.from({ length: 5 }, (_, i) => ({ nombre: `Software ${i + 1}` })),
        },
        factores: {
          create: factores.map((f) => ({
            idFactor: f.id,
            impSugerida: f.sugeridaDefault,
            alcanceEfectivo: f.alcanceDefault,
          })),
        },
        jurados: {
          create: jurados.map((j) => ({
            idUsuario: j.id,
            estado: 'activo' as const,
            dimensiones: { create: dimensiones.map((d) => ({ idDimension: d.id })) },
          })),
        },
      },
      include: { softwares: true, factores: true },
    });

    // Every judge rates every factor as Fundamental, so all 18 factors are relevant.
    await t.prisma.juradoImportancia.createMany({
      data: proyecto.factores.flatMap((pf) =>
        jurados.map((j) => ({ idProyectoFactor: pf.id, idUsuario: j.id, impDecisor: 4 })),
      ),
    });
    const url = `/api/proyectos/${proyecto.id}`;
    await t.http().post(`${url}/consolidacion/confirmar`).set(coord.auth).expect(201);

    const subfactores = factores.flatMap((f) => f.subfactores);
    expect(subfactores).toHaveLength(61);
    await t.prisma.evaluacionSubfactor.createMany({
      data: proyecto.softwares.flatMap((sw, s) =>
        jurados.flatMap((j, k) =>
          subfactores.map((sub, n) => ({
            idSoftware: sw.id,
            idUsuario: j.id,
            idSubfactor: sub.id,
            valor: ((s + k + n) % 4) + 1,
          })),
        ),
      ),
    });

    const inicio = performance.now();
    const res = await t.http().post(`${url}/resultados`).set(coord.auth).expect(201);
    const duracion = performance.now() - inicio;

    expect(res.body.softwares).toHaveLength(5);
    expect(res.body.softwares[0].scoresJurado).toHaveLength(10);
    expect(await t.prisma.resultadoJuradoFactor.count()).toBe(5 * 18 * 10);
    console.log(`RNF-04: POST /resultados with 5 software x 10 judges took ${Math.round(duracion)} ms`);
    expect(duracion).toBeLessThan(LIMITE_MS);
  }, 120_000);
});
