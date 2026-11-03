# Reparto de tareas para terminar GUIOS PRO

El sistema ya cubre todos los requisitos funcionales de la especificación: cuentas y roles,
recuperación de contraseña, proyectos y jurados, evaluación, consolidación, resultados,
comparación, auditoría, PDF, análisis con IA, catálogo con versiones e IS calculada (manual y con
IA). Lo que queda son **tareas de cierre**: configurar, probar con datos reales, pulir y documentar.

Antes de empezar, leé `README.md`, `AGENTS.md` y `docs/api-contract.md`.

## Cómo se trabaja

1. Actualizá y creá tu rama desde `main`:
   ```bash
   git switch main && git pull
   npm install
   npm run db:deploy -w @guios/api
   npm run db:catalogo -w @guios/api
   git switch -c <tipo>/<tu-tarea>
   ```
2. Primero la prueba, después el código.
3. Antes del PR, todo en verde: `npm test`, `npm run build`, `npx oxlint` (en `apps/web`) y
   `npx eslint "{src,test,prisma}/**/*.ts"` (en `apps/api`).
4. PR chico hacia `main`, revisado por otra persona. Commits en español con Conventional Commits.

## Reglas comunes

- Cálculos solo con `@guios/calculo` (RNF-03); nunca se reescribe una fórmula.
- Permisos en el servidor (RNF-08): `@Roles(...)` o `AccesoService` en toda ruta nueva.
- Cambios al modelo en un PR aparte con su migración.
- Claves solo en `apps/api/.env` y documentadas en `README.md`.

---

## Tarea 1 · Prueba de aceptación con datos reales (HU-06, RNF-04)

- Cargar el proyecto de referencia de la sección 4.8 del componente práctico (jurados,
  importancias y calificaciones) y comprobar el criterio HU-06: métrica 72.3 para A y 70.0 para B,
  nivel C para A y B para B. Convertirlo en una prueba e2e en `apps/api/test/`.
- Prueba de carga RNF-04: proyecto con 5 softwares y 10 jurados; `POST /resultados` en menos de 2 s.

## Tarea 2 · Configurar la IA y el correo en un entorno real

- Crear la clave de Anthropic (`IA_API_KEY`) y probar el análisis con IA y la estimación de IS
  con un factor real (por ejemplo "Integración con modelos de IA").
- Revisar con el docente los textos de las instrucciones de la IA
  (`apps/api/src/reportes/analisis.service.ts` y `apps/api/src/catalogo/estimacion-ia.service.ts`).
- Configurar SMTP (`SMTP_*`, `WEB_URL`) y probar la recuperación de contraseña de punta a punta.

## Tarea 3 · Medición de anclas (sección 6, `medicion_ancla`)

Hoy la estimación con IA usa los cortes de la versión vigente del catálogo. Falta la acción de
administrador "Medir anclas": medir los 18 factores con el mismo método (OpenAlex + IA), guardar
cada medición en `medicion_ancla`, calcular los cortes con `cuartilesInclusivos` y publicar una
versión nueva del catálogo con esos cortes. Reutilizá `EstimacionIaService` para medir cada factor.

## Tarea 4 · Pulido visual y accesibilidad (RNF-01, RNF-02, RNF-10)

- Comparar cada pantalla con los prototipos de `doc/img prototipo/` y ajustar espaciados y colores.
- Revisar en 1366 px y 768 px, navegación solo con teclado y contraste.
- Probar en Chrome, Firefox y Edge.

## Tarea 5 · Documentación y despliegue

- Manual de usuario breve por rol (administrador, coordinador, jurado) con capturas.
- Guía de despliegue (build de `apps/web`, API con `npm run start:prod -w @guios/api`, base
  PostgreSQL, variables de entorno) y respaldo de la base.

---

## Decisiones para confirmar con el docente

- Regla del nivel C: "D o A en un factor con IR 3 o 4" (implementada) o la versión de la tesis.
- Redondeo de la ID consolidada cuando la mediana da .5 (implementado: hacia abajo).
- Umbrales de las banderas: 10, 2, 80, 2 y 25 % (configurables en Configuración).
- El catálogo real tiene 61 subfactores, no 63; "Soporte" (Ambos) se cargó como externo.
