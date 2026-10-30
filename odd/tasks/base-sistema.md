# Feature: base del sistema GUIOS PRO

Base ejecutable del sistema (API NestJS + web React + PostgreSQL) sobre la que se
desarrolla cada módulo en profundidad. Spec: `doc/GUIOS PRO especificación de requerimientos.pdf`
(sección 10); diseño: `doc/img prototipo/`.

## Specs

- S1. "ya podemos desarrollar el sistema para tener la base y ir desarrollando cada modulo a profundidad"
- S2. Stack fijado por la especificación, sección 10: "El backend es NestJS y el frontend React con Vite, comunicados por una API REST." Monorepo `apps/api`, `apps/web`, `packages/calculo`.
- S3. Base de datos: PostgreSQL instalado en Windows (decisión del usuario: "PostgreSQL instalado en Windows (recomendado)").
- S4. RF-01: "Registrar usuarios con los roles de administrador, coordinador y jurado, con autenticación. El administrador viene creado por defecto, el autorregistro deja el rol invitado y solo el administrador asigna el rol coordinador."
- S5. RNF-08: "El acceso a las evaluaciones debe restringirse según la organización y el rol del usuario." Spec sección 2: "Los permisos se validan en el servidor; ocultar un botón no basta (RNF-08)."
- S6. HU-18 (criterio): "Dado un usuario que se registra, cuando completa el formulario, entonces su cuenta queda con rol invitado y no puede abrir pantallas de coordinador ni de administrador, ni siquiera escribiendo la URL."
- S7. La web reproduce el layout de los prototipos `01 Inicio.png`, `02 Mis evaluaciones.png`, `16 configuracion.png` y `17 login.png`: barra lateral con Inicio, Evaluaciones (Mis evaluaciones, Nuevo proyecto, Calificar factores, Consolidación y alcance, Comparación de softwares, Análisis con IA, Auditoría de jurados), Historial, Jurados, Catálogo de factores, Configuración; barra superior con búsqueda, notificaciones y usuario.
- S8. Rutas del frontend, spec sección 10: `/login`, `/registro`, `/recuperar`, `/inicio`, `/proyectos/nuevo`, `/evaluaciones`, `/proyectos/:id/...`, `/admin/catalogo`, `/admin/configuracion`.
- S10. Spec sección 9: `organizacion` "nombre, sector (público, privado, independiente), activo"; `usuario` "nombre, email único, password_hash, rol (invitado, coordinador, administrador), activo". Sección 2: "Cada usuario ve solo los proyectos de su organización." Actor Administrador: "Cuenta creada por defecto al instalar".
- S11. Usuario: "me avisas cuando ya tengamos construida la base y los modelos principales para subir a github y trabajar con mi equipo dividiendonos cada modulo". Modelo: spec sección 9 (tablas existentes, cambios, tablas nuevas y reglas de integridad).
- S9. RNF-05: la clave del servicio de IA solo en el servidor; secretos fuera de git (`.env`).

## Tasks

| ID | Specs | Tarea | Ruta | Estado | Commit |
| --- | --- | --- | --- | --- | --- |
| T1 | S2 | API NestJS: esqueleto, configuración por `.env`, `GET /api/health` con prueba | inline | hecha | db83901 |
| T2 | S2, S7, S8 | Web Vite + React + Tailwind: layout del prototipo, rutas y páginas base | inline | hecha | c9c1409 |
| T3 | S3, S4, S10 | Prisma + PostgreSQL: `organizacion`, `usuario`, migración, hash de contraseñas y seed idempotente del administrador | inline | hecha | cb36e32 |
| T4 | S4, S5, S6 | Autenticación: registro (invitado), login JWT, guards por rol, pruebas e2e | inline | hecha y revisada | 5b818d5, 6e02cf1 |
| T5 | S5, S6, S7 | Web: login real contra la API, rutas protegidas por rol | sesión 2 | hecha | bfa38d1 |
| T7 | S11 | Modelo de datos completo de la sección 9 en Prisma (catálogo, proyecto, respuestas, resultados, IA, estimación IS, anclas, recuperación) con reglas de integridad | inline | hecha | cb36e32 |
| T6 | S1 | `AGENTS.md` y README con comandos verificados | inline | hecha | ver git log (docs: agregar AGENTS.md) |

## Log

- L1 (usuario): "ya coloqué las imagenes en la carpeta img prototipo ya podemos desarrollar el sistema para tener la base y ir desarrollando cada modulo a profundidad"
- L2 (usuario): elige "PostgreSQL instalado en Windows (recomendado)". PostgreSQL y Docker no están instalados en la máquina; el usuario lo instala.
- L3 (decisión): ORM Prisma (esquema legible y migraciones explícitas); estilos con Tailwind (el diseño usa espaciado y colores regulares).
- L4 (cerrado): RN-13 (banderas), RN-14 (conteo de evidencia) y avisos de la sección 6 implementados por la sesión 2 (bf1c83e); DOI solo validado por sintaxis, la existencia la verifica el servidor (RNF-11).
- L6 (decisión): todas las rutas REST bajo el prefijo `/api` (el proxy de Vite reenvía `/api` sin CORS). Jest se mantiene en la API (estándar de Nest); Vitest en `calculo` y `web`.
- L7 (restricción): la política del agente bloquea escribir archivos `.env*`; las variables se documentan en el README y el usuario crea `apps/api/.env`.
- L8 (decisión): Vitest 5 en todo el monorepo y Vite 8 como devDependency de la raíz para tener una sola copia (Vitest 3 / Tailwind arrastraban Vite 7 y rompían los tipos). Rutas del menú sin proyecto en `/evaluaciones/<pantalla>`; las rutas de la spec `/proyectos/:id/<pantalla>` también existen.
- L10 (usuario): PostgreSQL 18 instalado (servicio `postgresql-x64-18`), base `guios` creada, `apps/api/.env` creado por el usuario con `PORT`, `DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`. El agente no lee ese archivo.
- L5 (pendiente): datos del proyecto de referencia de HU-06 (72.3 y 70.0) no están en el PDF; se piden al usuario.
- L9 (entrega): corte 1 = db83901..3b2d91f (API con /health + web base + prototipos), ~1220 líneas en 3 commits. PR y merge los decide el usuario.
- L11 (usuario): "ya tengo creado el repositorio me avisas cuando ya tengamos construida la base y los modelos principales para subir a github y trabajar con mi equipo dividiendonos cada modulo obviamente revisaremos los cambios q apliquen"
- L12 (decisión): T3 y T7 en un commit (cb36e32): 20 tablas de la sección 9 con CHECK; migración correctiva porque un CHECK dejaba pasar NULL. T4 en commit propio (5b818d5) por ser alto riesgo (seguridad). Subagentes escritores y verify no disponibles en esta sesión (cambió la raíz git); la revisión independiente de T4 se pidió a la sesión 2.
- L13 (pendiente, decisión de producto): pantallas de jurado para un invitado que es jurado de un proyecto; administrador en "Nuevo proyecto" (lectura de la tabla de permisos en disputa).
- L14 (usuario, aclara L13): "a lo q me quise referir es q un coorinador puede enviar una solicitud a un usuario para q se convierta en jurado de un proyecto no a que un usuario siempre será jurado". Jurado sigue siendo un rol por proyecto (`jurado_proyecto`, estado invitado/activo/finalizado, RF-03); los roles globales siguen siendo invitado, coordinador y administrador. Se descarta el cambio de la sesión 2 que hacía a jurado un rol global. El flujo de solicitud y el acceso a Calificar según la participación quedan para el módulo Proyectos y jurados.
- L15 (revisión): revisión de seguridad independiente de T4 (sesión 2 + gentle-ai-verify): S4, S5 y S6 cumplen. Corregidos en 6e02cf1: D1 (seed sin admin si ADMIN_EMAIL ya existe como no admin), D2 (JWT fijado a HS256), D4 (hash señuelo al iniciar) y D6 (ADMIN_PASSWORD de 8 caracteres o más). Quedan como deuda baja: D3 (prueba de JWT_SECRET ausente o corto), D5 (CHECK email = lower(email)), rate limiting en login y registro, y @Roles explícito en los módulos nuevos.
- L16 (usuario, vía sesión 2): el administrador no crea proyectos; se mantiene la tabla de permisos de la spec (no tiene organización, aprueba la IS del catálogo y así se conserva la trazabilidad). Cita: "me parece bien la decision q tomaste". Cierra la segunda parte de L13.
