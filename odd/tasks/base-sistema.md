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
- S9. RNF-05: la clave del servicio de IA solo en el servidor; secretos fuera de git (`.env`).

## Tasks

| ID | Specs | Tarea | Ruta | Estado | Commit |
| --- | --- | --- | --- | --- | --- |
| T1 | S2 | API NestJS: esqueleto, configuración por `.env`, `GET /api/health` con prueba | inline | hecha | db83901 |
| T2 | S2, S7, S8 | Web Vite + React + Tailwind: layout del prototipo, rutas y páginas base | inline | hecha | c9c1409 |
| T3 | S3, S4 | Prisma + PostgreSQL: `organizacion`, `usuario`, migración y seed del administrador | inline | bloqueada (PostgreSQL) | |
| T4 | S4, S5, S6 | Autenticación: registro (invitado), login JWT, guards por rol, pruebas e2e | inline | pendiente | |
| T5 | S5, S6, S7 | Web: login real contra la API, rutas protegidas por rol | inline | pendiente | |
| T6 | S1 | `AGENTS.md` y README con comandos verificados | inline | hecha | ver git log (docs: agregar AGENTS.md) |

## Log

- L1 (usuario): "ya coloqué las imagenes en la carpeta img prototipo ya podemos desarrollar el sistema para tener la base y ir desarrollando cada modulo a profundidad"
- L2 (usuario): elige "PostgreSQL instalado en Windows (recomendado)". PostgreSQL y Docker no están instalados en la máquina; el usuario lo instala.
- L3 (decisión): ORM Prisma (esquema legible y migraciones explícitas); estilos con Tailwind (el diseño usa espaciado y colores regulares).
- L4 (pendiente): RN-13 y RN-14 del paquete de cálculo quedan para el módulo de resultados y el de catálogo.
- L6 (decisión): todas las rutas REST bajo el prefijo `/api` (el proxy de Vite reenvía `/api` sin CORS). Jest se mantiene en la API (estándar de Nest); Vitest en `calculo` y `web`.
- L7 (restricción): la política del agente bloquea escribir archivos `.env*`; las variables se documentan en el README y el usuario crea `apps/api/.env`.
- L8 (decisión): Vitest 5 en todo el monorepo y Vite 8 como devDependency de la raíz para tener una sola copia (Vitest 3 / Tailwind arrastraban Vite 7 y rompían los tipos). Rutas del menú sin proyecto en `/evaluaciones/<pantalla>`; las rutas de la spec `/proyectos/:id/<pantalla>` también existen.
- L5 (pendiente): datos del proyecto de referencia de HU-06 (72.3 y 70.0) no están en el PDF; se piden al usuario.
- L9 (entrega): corte 1 = db83901..3b2d91f (API con /health + web base + prototipos), ~1220 líneas en 3 commits. PR y merge los decide el usuario.
