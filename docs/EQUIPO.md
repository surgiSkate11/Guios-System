# Reparto de tareas para terminar GUIOS PRO

La base, el cálculo (RN-01 a RN-14), el modelo de datos completo, la autenticación y los
módulos núcleo (administración, proyectos y jurados, evaluación, consolidación, resultados,
comparación, auditoría y catálogo de lectura) ya están hechos y probados. Quedan **cinco
tareas**, una por persona. Cada una es independiente de las demás.

Antes de empezar, leé `README.md`, `AGENTS.md` y `docs/api-contract.md`.

## Cómo se trabaja

1. Actualizá y creá tu rama desde `main`:
   ```bash
   git switch main && git pull
   npm install
   npm run db:deploy -w @guios/api
   npm run db:catalogo -w @guios/api
   git switch -c feat/<tu-tarea>
   ```
2. Primero la prueba, después el código. Cada regla nueva tiene al menos una prueba que falla antes.
3. Antes de abrir el PR, todo en verde: `npm test`, `npm run build`, `npx oxlint` (en `apps/web`)
   y `npx eslint "{src,test,prisma}/**/*.ts"` (en `apps/api`).
4. PR chico hacia `main`, revisado por otra persona. Commits en español con Conventional Commits.

## Reglas comunes (no negociables)

- **Cálculos solo con `@guios/calculo`** (RNF-03). Nunca se reescribe una fórmula en la API ni en la web.
- **Permisos en el servidor** (RNF-08): toda ruta nueva lleva `@Roles(...)` o usa `AccesoService`
  (`apps/api/src/proyectos/acceso.service.ts`) para proyectos. Ocultar un botón no alcanza.
- **Proyecto cerrado es inmutable** (RNF-09): usá `acceso.exigirAbierto(...)` antes de escribir.
- **Cambios al modelo** (`apps/api/prisma/schema.prisma`) van en un PR chico y aparte, con su
  migración (`npm run db:migrate -w @guios/api`), y se integran el mismo día.
- **Claves de servicios externos** solo en `apps/api/.env`; nunca en la web ni en git (RNF-05).
  Documentá las variables nuevas en `README.md`.
- Si tu tarea agrega rutas, actualizá `docs/api-contract.md` en el mismo PR.

---

## Tarea 1 · Exportar resultado a PDF (RF-19, HU-10)

**Objetivo:** el coordinador descarga en PDF el resultado de un proyecto.

- API: `GET /api/proyectos/:id/resultados/pdf` (coordinador del proyecto) que genera el PDF a
  partir del último informe guardado (`ResultadosService.ultimo`). `404 "Aún no hay resultados"`
  si no hay informe. Librería sugerida: `pdfkit` o `@react-pdf/renderer` en el servidor.
- Contenido mínimo: nombre del proyecto, organización, fecha, versión del catálogo, ranking con
  métrica, mínimo, máximo y desviación, nivel A/B/C, tabla FODA por software y banderas.
- Web: botón "Exportar PDF" en la pantalla de Comparación (`apps/web/src/pages/...`), visible
  solo si hay resultados generados.
- Pruebas: e2e del endpoint (200 con `content-type: application/pdf`, 404 sin informe, 403 para
  un jurado, 404 para un usuario ajeno) y prueba de la web del botón.

## Tarea 2 · Análisis con IA (RF-16, HU-09, RNF-05 a RNF-07)

**Objetivo:** texto de análisis de los resultados redactado por IA, con texto de respaldo.

- API: `POST /api/proyectos/:id/analisis` (coordinador) y `GET /api/proyectos/:id/analisis`
  (último análisis). Guarda **entrada, salida, modelo y estado** en la tabla `analisis_ia`.
- La entrada al modelo usa solo números ya calculados del último informe; **los jurados van
  seudonimizados** ("Jurado 1", "Jurado 2"), nunca nombre ni correo (RNF-05).
- Validación de la salida: el texto no puede contener números distintos de los del informe; si
  falla la validación o el servicio no responde, se guarda `estado = fallido` y se devuelve un
  **texto de respaldo** armado con plantillas a partir del informe (RNF-06).
- Variables nuevas en `.env`: proveedor, clave y modelo de IA. La clave nunca sale del servidor.
- Web: reemplazar el placeholder "Análisis con IA" (`router.tsx`, clave `analisis`) por la
  pantalla real con botón "Generar análisis" y "Regenerar".
- Pruebas: e2e con el cliente de IA simulado (respuesta válida, respuesta con número inventado →
  respaldo, servicio caído → respaldo) y verificación de que la entrada guardada no contiene
  nombres ni correos.

## Tarea 3 · Estimación de la IS con IA y edición del catálogo (RF-18, RF-22 a RF-24, HU-12, HU-16, HU-22 a HU-24)

**Objetivo:** el administrador crea factores nuevos y la IS se calcula al instante; la IA solo
estima citas.

- API (administrador), según la sección 10 de la especificación:
  `POST /api/catalogo/factores`, `POST /api/catalogo/factores/:id/estimaciones`,
  `GET /api/catalogo/estimaciones/:id`, `POST /api/catalogo/estimaciones/:id/aprobar`,
  `POST /api/catalogo/estimaciones/:id/rechazar`.
- La IS se calcula con `respaldoPorSubfactor`, `cuartilesInclusivos`, `importanciaLiteratura`,
  `importanciaSugerida` y `avisosEstimacion` de `@guios/calculo`. La IA **no** calcula números.
- Evidencia válida (RNF-11): DOI verificado, año 2020–2025 y cita textual presente en el resumen.
  Servicio bibliográfico sugerido: OpenAlex o Crossref. Solo se envían nombre del factor, textos
  de subfactores y resúmenes públicos (RNF-13).
- Aprobar crea una **nueva versión del catálogo** (`catalogo_version`); los proyectos existentes
  siguen con su versión (HU-24). Factores nuevos: `origen = lit_2020_2025`, `validadoExpertos = false`.
- La estimación tarda hasta 3 minutos: correrla en segundo plano y que la web consulte el avance (RNF-12).
- Web: alta de factor en `/admin/catalogo/factores/nuevo` con citas por subfactor y recálculo en
  vivo usando `@guios/calculo` en el navegador; aviso "Resultado sensible" y "Sin evidencia".
- Pruebas: criterios HU-22 (7 citas en 3 subfactores → r 2.33, IL 4, IS 3) y HU-23 (6 citas →
  r 2.00, IL 2, IS 2, aviso de sensible), respuestas de IA manipuladas descartadas y versión nueva al aprobar.

## Tarea 4 · Recuperar contraseña (RF-25)

**Objetivo:** recuperar la contraseña con un enlace temporal enviado por correo.

- API pública: `POST /api/auth/recuperar { email }` responde siempre `204` (no revela si el correo
  existe) y crea un token en `token_recuperacion` guardando **solo su hash** con vencimiento
  (sugerido: 30 minutos). `POST /api/auth/restablecer { token, password }` valida token vigente y
  no usado, cambia la contraseña con `hashPassword` y marca el token como usado.
- Envío de correo con `nodemailer`; en desarrollo, registrar el enlace en consola.
  Variables nuevas en `.env`: servidor SMTP y URL pública de la web.
- Web: reemplazar `PendingAuthPage` de `/recuperar` por el formulario real y agregar la pantalla
  de restablecer (por ejemplo `/restablecer?token=...`).
- Pruebas: token vencido, usado o inexistente → 400; correo inexistente → 204 sin crear token;
  la contraseña nueva permite iniciar sesión y la vieja no.

## Tarea 5 · Historial y deuda de seguridad (RF-17, HU-11, HU-20)

**Objetivo:** consultar proyectos cerrados y cerrar la deuda anotada en la revisión de seguridad.

- Web: reemplazar el placeholder "Historial" por la lista de proyectos cerrados
  (`GET /api/proyectos?estado=cerrado`) con versión del catálogo, fecha y acceso al resultado.
- API, deuda de seguridad (ver `odd/tasks/base-sistema.md`, L15):
  - límite de intentos en `POST /api/auth/login` y `POST /api/auth/registro`
    (por ejemplo `@nestjs/throttler`), con prueba de 429;
  - migración con `CHECK (email = lower(email))` en `usuario`;
  - prueba de que la API no arranca sin `JWT_SECRET` o con uno de menos de 32 caracteres.
- Modo de un solo jurado (RF-21, HU-20): prueba e2e del flujo completo con el coordinador como
  único jurado, de la creación al cierre.

---

## Decisiones para confirmar con el docente

- Regla del nivel C: "D o A en un factor con IR 3 o 4" (implementada) o la versión de la tesis.
- Redondeo de la ID consolidada cuando la mediana da .5 (implementado: hacia abajo).
- Umbrales de las banderas: 10, 2, 80, 2 y 25 % (configurables en Configuración).
- El catálogo real tiene 61 subfactores, no 63; "Soporte" (Ambos) se cargó como externo.
