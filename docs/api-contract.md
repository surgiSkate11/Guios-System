# GUIOS PRO — REST API contract (core modules)

Single source of truth between the API (`apps/api`) and the web (`apps/web`).
Change it only through its owner (API side) and note the change in the commit message.

## Conventions

- Every route is under `/api`, JSON in and out, `Authorization: Bearer <token>` unless marked **public**.
- Errors: `{ "statusCode": number, "message": string | string[] }`. `message` is Spanish UI copy.
  - `400` validation (`message` may be an array), `401` no/invalid session, `403` wrong global role,
    `404` not found **or not visible to the user** (projects of other organizations look missing),
    `409` business rule violated (message explains it).
- Dates: `fechaInicio` / `fechaFin` are `YYYY-MM-DD`; timestamps are ISO 8601.
- Global roles: `invitado`, `coordinador`, `administrador`. **Jurado is a per-project role**
  (`jurado_proyecto`): any active user can be invited to a project by its coordinator.
- Project access (server-side, RNF-08): the project's coordinator, or a judge of the project.
  Administrators do not see projects. Every `/api/proyectos/:id/**` route returns `404` otherwise.
- Calculations always use `@guios/calculo`; the API never reimplements a rule.

## Shared shapes

```ts
type Rol = 'invitado' | 'coordinador' | 'administrador';
type Sector = 'publico' | 'privado' | 'independiente';
type Alcance = 'interno' | 'externo';
type EstadoProyecto = 'borrador' | 'en_curso' | 'cerrado';
type EstadoJurado = 'invitado' | 'activo' | 'finalizado';
type Metodo = 'mediana' | 'promedio';
type Foda = 'fortaleza' | 'oportunidad' | 'debilidad' | 'amenaza';
type Nivel = 'A' | 'B' | 'C';

interface Organizacion { id: number; nombre: string; sector: Sector; activo: boolean }
interface UsuarioAdmin { id: number; nombre: string; email: string; rol: Rol; activo: boolean;
  idOrganizacion: number | null; organizacion: { id: number; nombre: string } | null }
interface UsuarioResumen { id: number; nombre: string; email: string }
interface Parametros { umbralFoda: number; umbralDesacuerdo: number; umbralEmpateTecnico: number;
  umbralMetricaAlta: number; umbralFactorDiscutido: number; umbralDatosInciertos: number;
  metodoConsolidacion: Metodo }
```

## A1. Administration (role `administrador`)

| Method and path | Body | Response |
| --- | --- | --- |
| `GET /api/organizaciones` | — | `Organizacion[]` (by name) |
| `POST /api/organizaciones` | `{ nombre, sector }` | `201 Organizacion` |
| `PATCH /api/organizaciones/:id` | `{ nombre?, sector?, activo? }` | `Organizacion` |
| `GET /api/usuarios` | — | `UsuarioAdmin[]` (by id) |
| `PATCH /api/usuarios/:id` | `{ rol?, idOrganizacion?: number \| null, activo? }` | `UsuarioAdmin` |
| `GET /api/parametros` | — (any signed-in user) | `Parametros` (global defaults) |
| `PUT /api/parametros` | full `Parametros` | `Parametros` |

Rules: a `coordinador` must have an organization (`409 "Un coordinador necesita una organización"`);
an administrator cannot change their own role or deactivate themselves
(`409 "No puedes modificar tu propia cuenta de administrador"`); inactive organization → `409`.
Threshold ranges: `umbralFoda` 1–4, `umbralFactorDiscutido` 0–3, the others 0–100.

## A2. Catalog (read: any signed-in user)

| Method and path | Response |
| --- | --- |
| `GET /api/catalogo/vigente` | `{ version: { id, numero, fecha, motivo, rq1, rq2, rq3 }, dimensiones: { id, nombre, factores: { id, nombre, sugeridaDefault, alcanceDefault, origen, validadoExpertos, subfactores: { id, texto }[] }[] }[] }` (active rows only) |
| `GET /api/catalogo/versiones` | `{ id, numero, fecha, motivo }[]` |

`404 "No hay un catálogo cargado"` when there is no version yet.

## A3. Projects and judges

```ts
interface ProyectoResumen {
  id: number; nombre: string; estado: EstadoProyecto; metodoConsolidacion: Metodo;
  fechaInicio: string; fechaFin: string | null; versionCatalogo: number;
  organizacion: { id: number; nombre: string };
  coordinador: UsuarioResumen;
  softwares: { id: number; nombre: string; version: string | null; licencia: string | null }[];
  jurados: { idUsuario: number; nombre: string; email: string; estado: EstadoJurado; idDimensiones: number[] }[];
  dimensiones: { id: number; nombre: string }[];
  miRol: 'coordinador' | 'jurado';          // coordinator wins if both
  miEstadoJurado: EstadoJurado | null;      // my judge state, if I am a judge
}
```

| Method and path | Who | Body | Response |
| --- | --- | --- | --- |
| `GET /api/proyectos?estado=` | any | — | `ProyectoResumen[]` visible to me, newest first |
| `POST /api/proyectos` | coordinador | `{ nombre, fechaInicio, fechaFin?, metodoConsolidacion, idDimensiones: number[] (≥1), softwares: { nombre, version?, licencia? }[] (≥1) }` | `201 ProyectoResumen` (estado `borrador`, my organization, current catalog version; creates one `proyecto_factor` per active factor of the chosen dimensions with the factor's IS and default scope) |
| `GET /api/proyectos/:id` | access | — | `ProyectoResumen` |
| `PATCH /api/proyectos/:id` | coordinator | `{ nombre?, fechaFin?, metodoConsolidacion? }` | `ProyectoResumen` |
| `POST /api/proyectos/:id/softwares` | coordinator | `{ nombre, version?, licencia? }` | `201 ProyectoResumen` |
| `DELETE /api/proyectos/:id/softwares/:idSoftware` | coordinator | — | `ProyectoResumen` (only in `borrador`) |
| `POST /api/proyectos/:id/estado` | coordinator | `{ estado: 'en_curso' \| 'cerrado' }` | `ProyectoResumen` |
| `GET /api/usuarios/buscar?email=` | coordinador | — | `UsuarioResumen` of an active user, else `404` |
| `POST /api/proyectos/:id/jurados` | coordinator | `{ idUsuario, idDimensiones?: number[] }` (default: all project dimensions) | `201 ProyectoResumen`; the judge starts `invitado` (`activo` when the coordinator adds themselves: single-judge mode, RF-21) |
| `PATCH /api/proyectos/:id/jurados/:idUsuario` | coordinator | `{ estado?: 'finalizado', idDimensiones?: number[] }` | `ProyectoResumen` |
| `DELETE /api/proyectos/:id/jurados/:idUsuario` | coordinator | — | `ProyectoResumen` (only while the judge has no answers) |
| `GET /api/solicitudes` | any | — | `ProyectoResumen[]` where I am a judge in state `invitado` |
| `POST /api/proyectos/:id/solicitud/aceptar` | invited judge | — | `ProyectoResumen` (judge → `activo`) |
| `POST /api/proyectos/:id/solicitud/rechazar` | invited judge | — | `204` (judge row removed) |

State rules: `borrador → en_curso` needs ≥1 software and ≥1 judge (`409` with the reason);
`en_curso → cerrado` needs generated results (`409 "Genera los resultados antes de cerrar"`).
A closed project is immutable (RNF-09): every write on it returns `409 "El proyecto está cerrado"`.

## A4. Judge answers (active judge of the project, project `en_curso`)

| Method and path | Body | Response |
| --- | --- | --- |
| `GET /api/proyectos/:id/importancias/mias` | — | `{ idProyectoFactor, factor: { id, nombre }, dimension: { id, nombre }, impSugerida, impDecisor: number \| null }[]` (only my dimensions) |
| `PUT /api/proyectos/:id/importancias/:idProyectoFactor` | `{ impDecisor: 1-4 }` | `{ idProyectoFactor, impDecisor }` |
| `GET /api/proyectos/:id/calificaciones/mias?software=:idSoftware` | — | `{ software: { id, nombre }, factores: { idProyectoFactor, factor: { id, nombre }, dimension: { id, nombre }, ir, pm: number \| null, subfactores: { id, texto, valor: 1-4 \| null, desconozco: boolean, respondido: boolean }[] }[] }` (relevant factors of my dimensions) |
| `PUT /api/proyectos/:id/calificaciones` | `{ idSoftware, idSubfactor, valor?: 1-4, desconozco?: true }` (exactly one) | `{ idProyectoFactor, pm: number \| null }` |

The consolidation method (`PATCH /api/proyectos/:id`) is frozen once consolidation is confirmed
(`409 "La consolidación ya fue confirmada"`); sending the same value is accepted.
Importances can change only before consolidation is confirmed (`409 "La consolidación ya fue confirmada"`);
ratings only after it (`409 "Primero se debe confirmar la consolidación"`).

## A5. Consolidation and scope (project coordinator)

| Method and path | Body | Response |
| --- | --- | --- |
| `GET /api/proyectos/:id/consolidacion` | — | `{ confirmada: boolean, metodo: Metodo, factores: { idProyectoFactor, factor: { id, nombre }, dimension: { id, nombre }, impSugerida, importancias: { idUsuario, nombre, impDecisor }[], faltantes: number, idConsolidada: number \| null, ir: number \| null, esRelevante: boolean \| null, alcanceDefault, alcanceEfectivo, justificacionAlcance: string \| null }[] }` (live preview until confirmed) |
| `POST /api/proyectos/:id/consolidacion/confirmar` | — | same shape, `confirmada: true` (`409 "Faltan N importancias por registrar"`) |
| `PATCH /api/proyectos/:id/factores/:idProyectoFactor/alcance` | `{ alcance, justificacion? }` | the factor row; justification required when `alcance` differs from the default (`400`) |

## A6. Results, comparison and audit

```ts
interface ResultadoProyecto {
  generadoEn: string | null;                    // null for a preview
  softwares: {
    id: number; nombre: string; ranking: number; nivel: Nivel;
    metrica: { final: number; minimo: number; maximo: number; desviacion: number };
    scoresJurado: { idUsuario: number; nombre: string; score: number | null }[];
    factores: { idProyectoFactor: number; nombre: string; ir: number; alcance: Alcance;
      pmPorJurado: { idUsuario: number; pm: number | null }[];
      pmConsolidada: number | null; foda: Foda | null }[];
  }[];
  banderas: { tipo: 'desacuerdo' | 'empate_tecnico' | 'metrica_contra_nivel' | 'metrica_alta_nivel_bajo'
    | 'factor_discutido' | 'datos_inciertos'; mensaje: string; idSoftware?: number;
    idProyectoFactor?: number; idUsuario?: number }[];
}
```

| Method and path | Who | Response |
| --- | --- | --- |
| `GET /api/proyectos/:id/resultados/vista-previa` | coordinator | `ResultadoProyecto` computed now; `409 { message: "Faltan N factores relevantes por evaluar", faltantes: N }` (RF-13) |
| `POST /api/proyectos/:id/resultados` | coordinator | `201 ResultadoProyecto` persisted (new `informe_evaluacion` version) |
| `GET /api/proyectos/:id/resultados` | access | last persisted `ResultadoProyecto`; `404 "Aún no hay resultados"` |
| `GET /api/proyectos/:id/resultados/mio` | judge | `{ softwares: { id, nombre, score: number \| null, factores: { idProyectoFactor, nombre, pm: number \| null, foda: Foda \| null }[] }[] }` |
| `GET /api/proyectos/:id/auditoria` | coordinator | `{ jurados: { idUsuario, nombre, estado, importancias: { idProyectoFactor, factor, impDecisor: number \| null }[], calificaciones: { total, desconozco, porcentajeDesconozco }, scores: { idSoftware, score: number \| null }[] }[] }` |

Ranking: by final metric descending; ties keep software id order. "Evaluated" (RF-13): every
active judge assigned to the factor's dimension answered every active subfactor of that factor
(value or Desconozco) for that software; `faltantes` counts incomplete (software, factor) pairs.

## A7. Password recovery (public, RF-25)

| Method and path | Body | Response |
| --- | --- | --- |
| `POST /api/auth/recuperar` | `{ email }` | `204` always (never reveals whether the email exists) |
| `POST /api/auth/restablecer` | `{ token, password }` (8-128 chars) | `204`; `400 "El enlace no es válido o venció"` |

The emailed link is `${WEB_URL}/restablecer?token=<token>`; tokens last 30 minutes and work once.
Login and sign-up answer `429` after too many attempts (rate limit).

## A8. PDF export (project coordinator, RF-19)

`GET /api/proyectos/:id/resultados/pdf` → `application/pdf` built from the last stored result;
`404 "Aún no hay resultados"`.

## A9. AI analysis (RF-16)

```ts
interface Analisis { id: number; texto: string; modelo: string; estado: 'completado' | 'fallido';
  respaldo: boolean; creadoEn: string }   // respaldo = fallback text was used
```

| Method and path | Who | Response |
| --- | --- | --- |
| `POST /api/proyectos/:id/analisis` | coordinator | `201 Analisis` from the last stored result (`404` without results). Never fails because of the AI: falls back to a template text (RNF-06) |
| `GET /api/proyectos/:id/analisis` | access | last `Analisis`; `404 "Aún no hay análisis"` |

## A10. Catalog administration (role `administrador`, RF-18, RF-22, RF-24)

```ts
interface Estimacion {
  id: number; estado: 'en_curso' | 'propuesta' | 'aprobada' | 'rechazada'; modo: 'manual' | 'ia';
  factor: { id: number; nombre: string; idDimension: number; alcanceDefault: Alcance };
  subfactores: { id: number; texto: string; citas: number; dois: string[] }[];
  cortes: { rq1: number; rq2: number; rq3: number };          // anchors of the current version
  tc: number | null; ns: number; r: number | null; il: number | null; isPropuesta: number | null;
  isAprobada: number | null; resultadoSensible: boolean; sinEvidencia: boolean;
  sinRespaldoVerificable: boolean;                             // some cited subfactor has no DOI
  progreso: { hechos: number; total: number } | null;          // AI mode while en_curso
  error: string | null; justificacion: string | null; creadoEn: string;
}
```

| Method and path | Body | Response |
| --- | --- | --- |
| `POST /api/catalogo/factores` | `{ idDimension, nombre, alcanceDefault, subfactores: { texto, citas: int ≥ 0, dois?: string[] }[] (≥1) }` | `201 Estimacion` (`modo: 'manual'`, `estado: 'propuesta'`); the factor is created inactive with `origen: lit_2020_2025` |
| `POST /api/catalogo/factores/:id/estimaciones` | — | `202 Estimacion` (`modo: 'ia'`, `estado: 'en_curso'`); poll it. Without AI configured: `409 "La estimación con IA no está configurada"` |
| `GET /api/catalogo/estimaciones/:id` | — | `Estimacion` |
| `GET /api/catalogo/estimaciones?estado=` | — | `Estimacion[]`, newest first |
| `POST /api/catalogo/estimaciones/:id/aprobar` | `{ citas?: { idSubfactor, citas }[], isAprobada?: 1-4, justificacion? }` | `Estimacion` approved; activates the factor with the IS and publishes a new catalog version. `isAprobada` different from the computed IS requires `justificacion` (`400`) |
| `POST /api/catalogo/estimaciones/:id/rechazar` | `{ justificacion }` | `Estimacion` rejected (the factor stays inactive) |
| `PATCH /api/catalogo/factores/:id` | `{ nombre?, alcanceDefault?, activo? }` | factor of `GET /catalogo/vigente` shape |
| `POST /api/catalogo/factores/:id/subfactores` | `{ texto }` | `201` subfactor `{ id, texto, activo }` |
| `PATCH /api/catalogo/subfactores/:id` | `{ texto?, activo? }` | subfactor |
| `GET /api/catalogo/factores` | — | every factor (active and inactive) with its subfactors (active and inactive) |

Only a `propuesta` can be approved or rejected (`409`). The IS is always computed by the server with
`@guios/calculo` (RN-01, RN-02, RN-04); the AI only finds and classifies articles (RNF-11).
Existing projects keep their IS snapshot (HU-24).
