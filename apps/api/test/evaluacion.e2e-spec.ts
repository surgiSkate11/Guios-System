import {
  crearOrganizacion,
  crearProyectoEnCurso,
  seedCatalogo,
} from './fixtures';
import { createTestContext, TestContext } from './helpers';

type Usuario = Awaited<ReturnType<TestContext['usuario']>>;

describe('Judge answers A4 and consolidation A5 (e2e, test database)', () => {
  let t: TestContext;
  let cat: Awaited<ReturnType<typeof seedCatalogo>>;
  let coord: Usuario;
  let j1: Usuario;
  let j2: Usuario;
  let j3: Usuario;
  let p: Awaited<ReturnType<typeof crearProyectoEnCurso>>;

  beforeAll(async () => {
    t = await createTestContext();
  });
  beforeEach(async () => {
    await t.reset();
    cat = await seedCatalogo(t.prisma);
    const org = await crearOrganizacion(t.prisma);
    coord = await t.usuario('coordinador', { idOrganizacion: org.id });
    j1 = await t.usuario('invitado', { nombre: 'Juez 1' });
    j2 = await t.usuario('invitado', { nombre: 'Juez 2' });
    j3 = await t.usuario('invitado', { nombre: 'Juez 3' });
    p = await crearProyectoEnCurso(t.prisma, cat, coord.id, org.id, [
      j1.id,
      j2.id,
      j3.id,
    ]);
  });
  afterAll(async () => {
    await t.reset();
    await t.app.close();
  });

  const url = (path: string) => `/api/proyectos/${p.id}${path}`;
  const importancia = (u: Usuario, idPf: number, impDecisor: unknown) =>
    t
      .http()
      .put(url(`/importancias/${idPf}`))
      .set(u.auth)
      .send({ impDecisor });

  /** Every judge rates every factor, then the coordinator confirms. */
  async function consolidar(
    usab: [number, number, number],
    doc: [number, number, number],
  ) {
    for (const [i, u] of [j1, j2, j3].entries()) {
      await importancia(u, p.pfUsabilidad, usab[i]).expect(200);
      await importancia(u, p.pfDocumentacion, doc[i]).expect(200);
    }
    return t.http().post(url('/consolidacion/confirmar')).set(coord.auth);
  }

  describe('importancias (RF-04, HU-02)', () => {
    it('lists my factors with the suggested importance', async () => {
      const res = await t
        .http()
        .get(url('/importancias/mias'))
        .set(j1.auth)
        .expect(200);
      expect(res.body).toEqual([
        {
          idProyectoFactor: p.pfUsabilidad,
          factor: { id: cat.usabilidad.id, nombre: 'Usabilidad' },
          dimension: { id: cat.tec.id, nombre: 'Tecnológica' },
          impSugerida: 3,
          impDecisor: null,
        },
        expect.objectContaining({
          idProyectoFactor: p.pfDocumentacion,
          impSugerida: 2,
          impDecisor: null,
        }),
      ]);
    });

    it('saves per judge without overwriting another judge', async () => {
      await importancia(j1, p.pfUsabilidad, 4).expect(200, {
        idProyectoFactor: p.pfUsabilidad,
        impDecisor: 4,
      });
      await importancia(j2, p.pfUsabilidad, 1).expect(200);
      await importancia(j1, p.pfUsabilidad, 2).expect(200);
      const mias = await t
        .http()
        .get(url('/importancias/mias'))
        .set(j1.auth)
        .expect(200);
      expect(mias.body[0].impDecisor).toBe(2);
      const otras = await t
        .http()
        .get(url('/importancias/mias'))
        .set(j2.auth)
        .expect(200);
      expect(otras.body[0].impDecisor).toBe(1);
    });

    it.each([0, 5, 2.5, 'tres'])(
      'rejects impDecisor %p with 400 and saves nothing',
      async (v) => {
        await importancia(j1, p.pfUsabilidad, v).expect(400);
        expect(await t.prisma.juradoImportancia.count()).toBe(0);
      },
    );

    it('answers 404 for a factor of another project and 403 for non-judges', async () => {
      await importancia(j1, 999999, 3).expect(404);
      await importancia(coord, p.pfUsabilidad, 3).expect(403);
      const ajeno = await t.usuario('invitado');
      await importancia(ajeno, p.pfUsabilidad, 3).expect(404);
    });

    it('rejects an invited (not yet active) judge with 403', async () => {
      await t.prisma.juradoProyecto.updateMany({
        where: { idUsuario: j1.id },
        data: { estado: 'invitado' },
      });
      await importancia(j1, p.pfUsabilidad, 3).expect(403);
    });

    it('rejects answers while the project is a draft', async () => {
      await t.prisma.proyectoEvaluacion.update({
        where: { id: p.id },
        data: { estado: 'borrador' },
      });
      const res = await importancia(j1, p.pfUsabilidad, 3).expect(409);
      expect(res.body.message).toBe('El proyecto todavía no está en curso');
    });

    it('locks importances once consolidation is confirmed', async () => {
      await consolidar([3, 3, 4], [1, 1, 1]).then((r) =>
        expect(r.status).toBe(201),
      );
      const res = await importancia(j1, p.pfUsabilidad, 1).expect(409);
      expect(res.body.message).toBe('La consolidación ya fue confirmada');
    });
  });

  describe('consolidacion (RF-05 to RF-07, HU-03, HU-04)', () => {
    it('previews ID, IR and relevance; HU-03: 3, 3 and 4 on IS 3 give ID 3, IR 3, relevant', async () => {
      for (const [u, v] of [
        [j1, 3],
        [j2, 3],
        [j3, 4],
      ] as const) {
        await importancia(u, p.pfUsabilidad, v).expect(200);
      }
      const res = await t
        .http()
        .get(url('/consolidacion'))
        .set(coord.auth)
        .expect(200);
      expect(res.body.confirmada).toBe(false);
      expect(res.body.metodo).toBe('mediana');
      const [usab, doc] = res.body.factores;
      expect(usab).toMatchObject({
        idProyectoFactor: p.pfUsabilidad,
        impSugerida: 3,
        faltantes: 0,
        idConsolidada: 3,
        ir: 3,
        esRelevante: true,
        alcanceDefault: 'externo',
        alcanceEfectivo: 'externo',
        justificacionAlcance: null,
      });
      expect(usab.importancias).toHaveLength(3);
      expect(doc).toMatchObject({
        faltantes: 3,
        idConsolidada: null,
        ir: null,
        esRelevante: null,
      });
    });

    it('refuses to confirm with missing importances', async () => {
      await importancia(j1, p.pfUsabilidad, 3).expect(200);
      const res = await t
        .http()
        .post(url('/consolidacion/confirmar'))
        .set(coord.auth)
        .expect(409);
      expect(res.body.message).toBe('Faltan 5 importancias por registrar');
      const fila = await t.prisma.proyectoFactor.findUniqueOrThrow({
        where: { id: p.pfUsabilidad },
      });
      expect(fila.esRelevante).toBeNull();
    });

    it('confirms and persists ID, IR and relevance (IS 2 with ID 1 is not relevant)', async () => {
      const res = await consolidar([3, 3, 4], [1, 1, 2]);
      expect(res.status).toBe(201);
      expect(res.body.confirmada).toBe(true);
      const filas = await t.prisma.proyectoFactor.findMany({
        where: { idProyecto: p.id },
        orderBy: { id: 'asc' },
      });
      expect(
        filas.map((f) => [f.impDecisorConsol, f.impRelativa, f.esRelevante]),
      ).toEqual([
        [3, 3, true],
        [1, 1, false],
      ]);
      await t
        .http()
        .post(url('/consolidacion/confirmar'))
        .set(coord.auth)
        .expect(409);
    });

    it('locks the consolidation method once consolidation is confirmed', async () => {
      const res = await consolidar([3, 3, 4], [1, 1, 1]);
      expect(res.status).toBe(201);
      const patch = await t
        .http()
        .patch(`/api/proyectos/${p.id}`)
        .set(coord.auth)
        .send({ metodoConsolidacion: 'promedio' })
        .expect(409);
      expect(patch.body.message).toBe('La consolidación ya fue confirmada');
      const proyecto = await t.prisma.proyectoEvaluacion.findUniqueOrThrow({
        where: { id: p.id },
      });
      expect(proyecto.metodoConsolidacion).toBe('mediana');
      // Other fields stay editable.
      await t
        .http()
        .patch(`/api/proyectos/${p.id}`)
        .set(coord.auth)
        .send({ nombre: 'Renombrado', metodoConsolidacion: 'mediana' })
        .expect(200);
    });

    it('uses the mean when the project chooses it', async () => {
      await t.prisma.proyectoEvaluacion.update({
        where: { id: p.id },
        data: { metodoConsolidacion: 'promedio' },
      });
      // Mean of 1, 4, 4 is 3 (median would be 4).
      for (const [u, v] of [
        [j1, 1],
        [j2, 4],
        [j3, 4],
      ] as const) {
        await importancia(u, p.pfUsabilidad, v).expect(200);
      }
      const res = await t
        .http()
        .get(url('/consolidacion'))
        .set(coord.auth)
        .expect(200);
      expect(res.body.factores[0].idConsolidada).toBe(3);
    });

    it('only the coordinator sees and confirms the consolidation', async () => {
      await t.http().get(url('/consolidacion')).set(j1.auth).expect(403);
      await t
        .http()
        .post(url('/consolidacion/confirmar'))
        .set(j1.auth)
        .expect(403);
    });

    it('reclassifies scope with a mandatory justification (RF-07)', async () => {
      const path = url(`/factores/${p.pfUsabilidad}/alcance`);
      await t
        .http()
        .patch(path)
        .set(coord.auth)
        .send({ alcance: 'interno' })
        .expect(400);
      const res = await t
        .http()
        .patch(path)
        .set(coord.auth)
        .send({
          alcance: 'interno',
          justificacion: 'Lo gestiona la organización',
        })
        .expect(200);
      expect(res.body).toMatchObject({
        alcanceDefault: 'externo',
        alcanceEfectivo: 'interno',
        justificacionAlcance: 'Lo gestiona la organización',
      });
      const back = await t
        .http()
        .patch(path)
        .set(coord.auth)
        .send({ alcance: 'externo' })
        .expect(200);
      expect(back.body).toMatchObject({
        alcanceEfectivo: 'externo',
        justificacionAlcance: null,
      });
      await t
        .http()
        .patch(path)
        .set(j1.auth)
        .send({ alcance: 'externo' })
        .expect(403);
    });
  });

  describe('calificaciones (RF-08, HU-05)', () => {
    const calificar = (u: Usuario, body: object) =>
      t.http().put(url('/calificaciones')).set(u.auth).send(body);

    it('requires a confirmed consolidation', async () => {
      const sub = cat.usabilidad.subfactores[0].id;
      const res = await calificar(j1, {
        idSoftware: p.softwares[0].id,
        idSubfactor: sub,
        valor: 3,
      }).expect(409);
      expect(res.body.message).toBe(
        'Primero se debe confirmar la consolidación',
      );
    });

    it('lists only relevant factors and updates the PM on each answer', async () => {
      await consolidar([3, 3, 4], [1, 1, 1]);
      const sw = p.softwares[0].id;
      const [s1, s2] = cat.usabilidad.subfactores;

      const vacia = await t
        .http()
        .get(url(`/calificaciones/mias?software=${sw}`))
        .set(j1.auth)
        .expect(200);
      expect(vacia.body.software).toEqual({ id: sw, nombre: 'Software A' });
      expect(vacia.body.factores).toHaveLength(1);
      expect(vacia.body.factores[0]).toMatchObject({
        idProyectoFactor: p.pfUsabilidad,
        ir: 3,
        pm: null,
      });
      expect(vacia.body.factores[0].subfactores).toEqual([
        {
          id: s1.id,
          texto: 'Usabilidad 1',
          valor: null,
          desconozco: false,
          respondido: false,
        },
        {
          id: s2.id,
          texto: 'Usabilidad 2',
          valor: null,
          desconozco: false,
          respondido: false,
        },
      ]);

      await calificar(j1, {
        idSoftware: sw,
        idSubfactor: s1.id,
        valor: 4,
      }).expect(200, {
        idProyectoFactor: p.pfUsabilidad,
        pm: 4,
      });
      await calificar(j1, {
        idSoftware: sw,
        idSubfactor: s2.id,
        valor: 1,
      }).expect(200, {
        idProyectoFactor: p.pfUsabilidad,
        pm: 2.5,
      });
      // "Desconozco" is excluded from the PM (RN-07).
      await calificar(j1, {
        idSoftware: sw,
        idSubfactor: s2.id,
        desconozco: true,
      }).expect(200, {
        idProyectoFactor: p.pfUsabilidad,
        pm: 4,
      });
      const llena = await t
        .http()
        .get(url(`/calificaciones/mias?software=${sw}`))
        .set(j1.auth)
        .expect(200);
      expect(llena.body.factores[0].pm).toBe(4);
      expect(llena.body.factores[0].subfactores[1]).toMatchObject({
        valor: null,
        desconozco: true,
        respondido: true,
      });
    });

    it.each([
      [{ valor: 3, desconozco: true }],
      [{}],
      [{ valor: 5 }],
      [{ desconozco: false }],
    ])('rejects %j with 400 and stores nothing', async (extra) => {
      await consolidar([3, 3, 4], [1, 1, 1]);
      await calificar(j1, {
        idSoftware: p.softwares[0].id,
        idSubfactor: cat.usabilidad.subfactores[0].id,
        ...extra,
      }).expect(400);
      expect(await t.prisma.evaluacionSubfactor.count()).toBe(0);
    });

    it('rejects subfactors of non-relevant factors and software of other projects with 404', async () => {
      await consolidar([3, 3, 4], [1, 1, 1]);
      await calificar(j1, {
        idSoftware: p.softwares[0].id,
        idSubfactor: cat.documentacion.subfactores[0].id,
        valor: 3,
      }).expect(404);
      await calificar(j1, {
        idSoftware: 999999,
        idSubfactor: cat.usabilidad.subfactores[0].id,
        valor: 3,
      }).expect(404);
      await t
        .http()
        .get(url('/calificaciones/mias?software=999999'))
        .set(j1.auth)
        .expect(404);
    });
  });
});
