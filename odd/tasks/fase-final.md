# Feature: fase final de GUIOS PRO

Terminar la mayor parte del sistema para que el equipo solo haga tareas sencillas. Rama
`feat/fase-final`. Contrato: `docs/api-contract.md` A7 a A10.

## Specs

- S1. Usuario: "prefiero q sigamos terminando con la mayor parte del sistema, hazlo ahorrando tokens por ejemplo pára un commit uregente saltala con: git commit --no-verify . Optimiza , trabaja sin desperdiciar token y desarrolla la mayor parte del sistema para q mis compañeros tengan q hacer cosas sencillas"
- S2. Tareas de `docs/EQUIPO.md` (PDF, análisis con IA, catálogo e IS, recuperar contraseña, historial y deuda de seguridad).

## Tasks

| ID | Tarea | Ruta | Estado | Commit |
| --- | --- | --- | --- | --- |
| B1 | API: recuperar contraseña + límite de intentos + deuda de seguridad | sesión 1 | hecha | 64bcd22 |
| B2 | API: PDF del resultado | sesión 1 | hecha | 63c5f56 |
| B3 | API: análisis con IA y texto de respaldo | sesión 1 | hecha | 63c5f56 |
| B4 | API: administración del catálogo e IS manual | sesión 1 | hecha | 57f901e |
| B5 | API: estimación de IS con IA (OpenAlex + LLM) | sesión 1 | hecha | ver git log |
| V1 | Web: recuperar y restablecer contraseña, historial | sesión 2 | hecha | e88fee7 |
| V2 | Web: botón PDF y pantalla de análisis con IA | sesión 2 | hecha | bbfde37 |
| V3 | Web: administración del catálogo con IS en tiempo real | sesión 2 | hecha | dfe4bc8 |
| B6 | API: migración de la versión 1 con las anclas de tesis y medición incremental de anclas | sesión 3 | hecha | ver git log |
| V4 | Web: panel "Medir anclas" en el catálogo con cortes, dispersión y sondeo del avance | sesión 3 | hecha | ver git log |

## Log

- L1 (usuario): ver S1. Commits con `--no-verify` (salta los hooks); las pruebas se siguen corriendo antes de cada commit.
- L2 (decisión): proveedor de IA detrás de una interfaz; implementación con la API de Anthropic configurada por `.env` (`IA_API_KEY`, `IA_MODELO`). Sin clave, análisis usa texto de respaldo y la estimación con IA responde 409. Servicio bibliográfico: OpenAlex.
- L3 (revisión): revisión nativa de B1 (64bcd22) aprobada; se corrigió que restablecer invalide los demás enlaces pendientes (revisión aprobada sin hallazgos). Deuda anotada, no bloqueante: el límite de intentos es por IP (puede afectar a usuarios detrás de la misma red), sin SMTP el enlace se imprime en la consola (solo desarrollo), un JWT emitido antes del cambio de contraseña sigue vigente hasta vencer (8 h) y el tiempo de respuesta de /recuperar difiere si el correo existe.
- L4 (revisión): revisión nativa de feat/fase-final por commit (la rama entera excedía el presupuesto). Todos aprobados: 64bcd22 + 963b6dc, 63c5f56, 57f901e, 99b3486, e88fee7, bbfde37, dfe4bc8. Avisos no bloqueantes para el equipo: aprobar una estimación puede competir con otra aprobación simultánea (sin bloqueo optimista); PATCH de factor no valida contra estimaciones abiertas; GET /analisis visible a jurados; rutas reales de IA sin prueba con un modelo real; una estimación queda en_curso si el proceso se reinicia; la web oculta el botón PDF ante un error transitorio y deja de consultar el avance de la estimación ante un error de red.
- L5 (correcciones): hallazgos de la revisión corregidos en fix/hallazgos-revision: aprobación condicional (la prueba de carrera no reproduce la carrera de forma determinista; queda como resguardo), 409 al activar un factor con estimación pendiente, estimaciones huérfanas al iniciar, botón PDF ante errores transitorios, sondeo con reintento y liberación diferida de la URL del PDF (sin prueba RED posible en jsdom; se ajustó la prueba existente). Se mantiene por diseño: GET /analisis visible a los jurados del proyecto. API 160 e2e, web 202.
- L6 (Tarea 3, anclas): la migración de datos 20261105040000_catalogo_inicial_tesis siembra la versión 1 de sistema con las 18 anclas de la tesis (TC 243, NS 61, cortes 1.86/3.65/4.78) y `db:catalogo` carga lo mismo desde `prisma/catalogo.json`, sin duplicar si ya existe. La medición es incremental: solo se miden los factores activos sin ancla en la versión vigente y las anclas previas conservan citas, NS y r; los cortes se recalculan con cuartiles inclusivos sobre todas. Agregar o renombrar subfactores de un factor con IS aprobada responde 409 para que ningún IS quede desactualizado. En web, `AnclasCatalogo` vive en `/admin/catalogo` con tabla de anclas e IL derivada, cortes, dispersión, confirmación en línea, progreso `aria-live` y errores 400/409 en `role="alert"`. Se añadió `src/test/jest-dom.d.ts` para recuperar la augmentación de tipos que se perdió al registrar los matchers con `expect.extend`. Cálculo 124, API unit 10, API e2e 174, web 206; build y oxlint en verde.
- L7 (Tarea 3, cierre documental): el catálogo explica en pantalla qué son TC, NS, r, IL, IS y los cortes (bloque "Cómo se leen los indicadores" en `CatalogoPage` y leyenda de la tabla de anclas). `docs/migracion-catalogo-anclas/README.md` documenta la migración, el flujo de medición, las Tareas 1 y 3 y lo que falta. Pendiente para probar la medición desde la interfaz: `IA_API_KEY` real en `apps/api/.env` y medir un factor nuevo. Web 207; API unit 10, API e2e 174; typecheck, build y oxlint en verde.
