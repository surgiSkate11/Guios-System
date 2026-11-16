# Catálogo, indicadores y medición de anclas

Cómo se carga el catálogo de la tesis, qué significan los indicadores que muestra la pantalla
del catálogo y cómo funciona la medición de anclas (sección 6 de la especificación).

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
([`CatalogoPage.tsx`](../apps/web/src/pages/catalogo/CatalogoPage.tsx)) y la tabla de anclas
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

Toda la aritmética vive en `@guios/calculo` ([`importancia.ts`](../packages/calculo/src/importancia.ts),
[`evidencia.ts`](../packages/calculo/src/evidencia.ts)); la API y la web la importan, nunca la
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

## 4. Requisitos y limitaciones

- La medición de anclas y la estimación de la IS con IA necesitan `IA_API_KEY` en `apps/api/.env`
  y salida a Internet (OpenAlex). Sin clave, `POST /api/catalogo/anclas/medir` responde
  `409 "La medición de anclas requiere la IA configurada"` y la web muestra ese mensaje.
- Con el catálogo de la tesis recién cargado, los 18 factores ya tienen ancla, así que el botón
  "Medir anclas" solo se habilita después de aprobar un factor nuevo.
- La medición en curso vive en memoria del servidor: si se reinicia, se pierde el avance sin
  publicar nada y las anclas anteriores siguen intactas.
