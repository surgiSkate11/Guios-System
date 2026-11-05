# Migración del catálogo y medición de anclas

> Rama `feat/migracion-catalogo-anclas` · 5 de noviembre de 2026 · Tareas 1 y 3 de
> `docs/EQUIPO.md`, sección 6 de la especificación (Rea Sánchez, 2022).

Este documento explica la migración de datos que deja cargada la versión 1 del catálogo con sus
anclas, la medición incremental de anclas con OpenAlex + IA, el glosario de indicadores que ahora
se muestra en la pantalla del catálogo y el estado real de las Tareas 1 y 3.

## 1. Qué es esta migración

`apps/api/prisma/migrations/20261105040000_catalogo_inicial_tesis/migration.sql` es una
**migración de datos**, no de esquema: las tablas `catalogo_version`, `dimension`, `factor`,
`subfactor` y `medicion_ancla` ya existían en `prisma/schema.prisma`. La migración se ejecuta con
`prisma migrate deploy` y deja:

- La versión 1 del catálogo con motivo de sistema y los cortes de la tesis: `rq1 = 1.86`,
  `rq2 = 3.65`, `rq3 = 4.78`.
- 3 dimensiones: Tecnológica, Organizacional y Económica.
- 18 factores y 61 subfactores (Tabla 7 de la tesis).
- Las 18 anclas de la Tabla 7, medidas entre 2008 y 2019, con **TC 243** y **NS 61**.

Cada sentencia está guardada con `WHERE NOT EXISTS`, así que volver a ejecutarla **no duplica**
filas: solo rellena lo que falte. El mismo catálogo vive en `apps/api/prisma/catalogo.json` y
`npm run db:catalogo -w @guios/api` lo carga de forma idempotente cuando la base está vacía. Los
dos orígenes deben mantenerse sincronizados.

`r` nunca se escribe en el JSON ni en la migración: se deriva de `r = TC / NS` (RN-01), que es
exactamente lo que reproduce los cortes 1.86 / 3.65 / 4.78.

## 2. Glosario: TC, NS, r, IL, IS y cortes

La pantalla `/admin/catalogo` ahora muestra el bloque **"Cómo se leen los indicadores"**
([`CatalogoPage.tsx`](../../apps/web/src/pages/catalogo/CatalogoPage.tsx)) y la tabla de anclas
lleva la leyenda completa. Las definiciones son:

| Sigla | Nombre | Definición | Regla |
| --- | --- | --- | --- |
| **TC** | Total de citas | Citas verificadas de los subfactores del factor: artículos revisados de 2020-2025 con DOI bien formado, contados una vez por subfactor que respaldan. | RN-14 |
| **NS** | Número de subfactores | Subfactores del factor que se midieron. Es el divisor del respaldo. | RN-01 |
| **r** | Respaldo por subfactor | `r = TC / NS`: promedio de citas por subfactor. Es el valor que ubican los cortes. | RN-01 |
| **IL** | Importancia de la literatura | Nivel 1-4 de `r` frente a los cortes: `r <= rq1 → 1`, `r <= rq2 → 2`, `r <= rq3 → 3`, si no `4`. Un empate cae en el cuartil inferior. | RN-02 |
| **IS** | Importancia sugerida | `IS = matriz(IE, IL)` con `IE = 3`, es decir `floor((IE + IL) / 2)`. | RN-03, RN-04 |
| **Cortes** | `rq1`, `rq2`, `rq3` | Cuartiles inclusivos (equivalente a `QUARTILE.INC` de Excel) de los `r` de todas las anclas de la versión. Solo cambian al medir anclas nuevas. | RN-02 |

Ejemplo con la versión 1: Compatibilidad tiene `TC = 33`, `NS = 8`, entonces
`r = 33 / 8 = 4.13`. Como `4.13 <= rq3 = 4.78`, la IL es **3** (Importante). Las anclas de la
tabla muestran su IL calculada con los cortes publicados
**en su misma versión**: si una versión nueva recalcula los cortes, el `r` del ancla no cambia,
pero su IL puede cambiar.

Toda la aritmética vive en `@guios/calculo` ([`importancia.ts`](../../packages/calculo/src/importancia.ts),
[`evidencia.ts`](../../packages/calculo/src/evidencia.ts)); la API y la web la importan, nunca la
reimplementan (RNF-03).

## 3. Cómo funciona la medición de anclas

1. En `/admin/catalogo`, un administrador ve las anclas de la versión vigente con su TC, NS, `r` e
   IL, los cortes y la dispersión (`mínimo`, `mediana`, `promedio`, `máximo`, `desviación`).
2. El botón **"Medir anclas"** se habilita solo si quedan factores activos sin ancla. Pide
   confirmación en línea porque publica una versión nueva del catálogo.
3. `POST /api/catalogo/anclas/medir` responde `202` y trabaja en segundo plano. La web consulta
   `GET /api/catalogo/anclas` cada 2 s y muestra el avance con `aria-live`.
4. La medición es **incremental** (sección 6): solo se miden los factores activos del catálogo
   global que todavía no tienen ancla en la versión vigente. Un ancla existente conserva sus
   citas, su NS y su `r` para siempre.
5. Por cada factor nuevo se reutiliza `EstimacionIaService`: OpenAlex busca artículos 2020-2025,
   la IA solo los clasifica y devuelve una cita literal, y el servidor verifica DOI y cita antes
   de contar (RNF-11). TC, NS, `r`, IL e IS los calcula el servidor con `@guios/calculo`
   (RNF-03). La estimación temporal se rechaza con una justificación para que el factor siga
   editable.
6. Al terminar, `MedicionAnclasService.publicar` crea una versión nueva con **todas** las anclas
   (las heredadas más las nuevas) y recalcula los cortes con `cuartilesInclusivos` sobre todos los
   `r`. Los proyectos existentes conservan su versión fijada, así que su IS no cambia.
7. Si algo falla (IA no configurada, error de OpenAlex, timeout de 15 min), la medición queda en
   `fallida` con el mensaje, **no publica nada** y las anclas anteriores siguen intactas (RNF-06).

La lista de subfactores de un factor con IS aprobada está congelada: agregar, renombrar o
desactivar un subfactor responde `409` para que el IS aprobado no quede desactualizado
(RF-22, RF-24).

## 4. Tarea 1 · Prueba de aceptación con datos reales (HU-06, RNF-04)

### Qué se hizo

- Se añadió `apps/api/test/aceptacion-hu06.e2e-spec.ts` con el escenario calibrado en
  `apps/api/test/datos-referencia-hu06.ts` (commit `bc4f67e`).
- La prueba corre contra la base aislada `guios_test` y verifica el criterio HU-06:
  métrica **72.3** para el software A y **70.0** para el software B, nivel **C** para A y
  **B** para B.
- También comprueba que los resultados guardados se leen igual que la vista previa.

### Qué falta para completarla

- Confirmar con el docente los datos del proyecto de referencia de la sección 4.8 del componente
  práctico (jurados, importancias y calificaciones) y sustituir los valores calibrados si difieren.
- Prueba de carga RNF-04: proyecto con **5 softwares y 10 jurados** y `POST /resultados` en menos
  de **2 s**, con el tiempo medido y registrado. Hoy no existe como prueba automatizada.
- Ejecutar la prueba contra un PostgreSQL real con `db:seed` y anotar el resultado en este
  documento o en `odd/tasks/fase-final.md`.

## 5. Tarea 3 · Medición de anclas (sección 6, `medicion_ancla`)

### Qué se hizo

- Migración de datos `20261105040000_catalogo_inicial_tesis` con la versión 1 completa y las 18
  anclas de la tesis (TC 243, NS 61, cortes 1.86 / 3.65 / 4.78).
- `cargar-catalogo.ts` y `prisma/catalogo.json` cargan los mismos valores y las anclas, derivando
  `r = TC / NS`.
- `MedicionAnclasService` mide solo factores sin ancla, publica una versión nueva con los cortes
  recalculados y expone estado, progreso, error y dispersión. Un mutex en memoria impide dos
  mediciones simultáneas (RNF-12).
- `GET /api/catalogo/anclas` y `POST /api/catalogo/anclas/medir` documentados en
  `docs/api-contract.md` **A11**.
- Panel web `AnclasCatalogo` en `/admin/catalogo`: tabla Factor / TC / NS / r / IL, cortes,
  dispersión, confirmación en línea, sondeo con reintento, progreso accesible y errores `400`/`409`
  en `role="alert"`.
- Glosario TC / NS / r / IL / IS en la pantalla del catálogo y en la leyenda de la tabla.

### Qué falta para terminarla

- **Configurar la IA en un entorno real.** La pieza que falta para medir anclas desde la interfaz
  es `IA_API_KEY` (y opcionalmente `IA_MODELO`) en `apps/api/.env`, con salida a Internet para
  OpenAlex. Sin clave, `POST /api/catalogo/anclas/medir` responde exactamente
  `409 "La medición de anclas requiere la IA configurada"` y la web muestra ese mensaje. La clave
  no se commitea: `.env` está ignorado por Git.
- Con la IA configurada, medir un factor nuevo desde `/admin/catalogo` (por ejemplo
  **"Integración con modelos de IA"**), confirmar que se publica una versión nueva, que los cortes
  cambian y que el ancla heredada no cambió su TC, NS ni `r`.
- Revisar con el docente los cortes resultantes y los textos de instrucción de la IA
  (`apps/api/src/catalogo/estimacion-ia.service.ts`).
- Verificar en una muestra que las citas devueltas por la IA son literales del abstract (RNF-11).
- Deuda conocida: el trabajo de medición vive en memoria, así que un reinicio del servidor pierde
  el avance (no se publica nada). Si se necesita, persistir el trabajo o retomarlo al arrancar.

## 6. Archivos tocados

| Archivo | Cambio |
| --- | --- |
| `apps/api/prisma/migrations/20261105040000_catalogo_inicial_tesis/migration.sql` | Nueva migración de datos: versión 1, 18 factores, 61 subfactores y 18 anclas. |
| `apps/api/prisma/catalogo.json` | `periodoAnclas` 2008-2019 y `ancla { ns, citas }` por factor. |
| `apps/api/prisma/cargar-catalogo.ts` | Informa también las anclas cargadas. |
| `apps/api/src/catalogo/cargar-catalogo.ts` | Valida y carga anclas derivando `r = TC / NS`. |
| `apps/api/src/catalogo/catalogo-admin.service.ts` | Congela la lista de subfactores si el factor tiene IS aprobada (`409`). |
| `apps/api/src/catalogo/medicion-anclas.service.ts` | Medición incremental, publicación de versión y cortes. |
| `apps/api/test/catalogo-admin.e2e-spec.ts`, `catalogo.e2e-spec.ts`, `medicion-anclas.e2e-spec.ts` | Cobertura de anclas, congelamiento y medición. |
| `apps/api/test/aceptacion-hu06.e2e-spec.ts`, `datos-referencia-hu06.ts` | Tarea 1: criterio HU-06. |
| `apps/web/src/api/catalogo.ts` | Tipos y llamadas de A11. |
| `apps/web/src/pages/catalogo/AnclasCatalogo.tsx` (+ test) | Panel de anclas con TC, NS, r, IL, cortes, dispersión y sondeo. |
| `apps/web/src/pages/catalogo/CatalogoPage.tsx` (+ test) | Glosario de indicadores y leyenda. |
| `apps/web/src/test/catalogo-api.ts`, `setup.ts`, `jest-dom.d.ts` | Datos falsos de anclas y matchers de DOM tipados. |
| `docs/api-contract.md` | Sección A11 y aclaraciones de A10.1. |
| `docs/EQUIPO.md`, `odd/tasks/fase-final.md` | Estado de las Tareas 1 y 3. |
| `.gitignore` | Excluye `/doc/doc_juan/` (material personal). |

## 7. Archivos restringidos o protegidos

- `apps/api/.env` **no se leyó ni se modificó**. Contiene `DATABASE_URL`, `IA_API_KEY`, `SMTP_*` y
  secretos; está ignorado por Git. Configurar la IA es un paso manual del equipo.
- `apps/api/src/generated/` (cliente de Prisma) sigue ignorado: se regenera con
  `npm run db:migrate -w @guios/api` o al compilar.
- La migración nueva no altera el esquema ni los tipos; es solo `INSERT` de datos.
- `.gitignore` solo agrega el material personal `/doc/doc_juan/`; ningún archivo de código,
  migración o configuración quedó excluido.
- No se tocaron dependencias ni `package-lock.json`.

## 8. Cómo verificar

```bash
npm install
npm run db:deploy -w @guios/api     # aplica la migración de datos
npm run db:catalogo -w @guios/api   # idempotente: no duplica si ya existe
npm run test -w @guios/calculo
npm run test -w @guios/api -- medicion-anclas
npm run test -w @guios/web -- CatalogoPage
npx oxlint                          # dentro de apps/web
npx eslint "{src,test}/**/*.ts"     # dentro de apps/api
```

Comprobación rápida en SQL:

```sql
SELECT numero, rq1, rq2, rq3 FROM catalogo_version ORDER BY numero;
SELECT count(*), sum(citas), sum(ns) FROM medicion_ancla WHERE id_catalogo_version = 1;
-- 18 | 243 | 61
```
