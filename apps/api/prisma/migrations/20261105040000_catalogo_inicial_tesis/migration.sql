-- ---------------------------------------------------------------------------
-- Version 1 of the catalog (Rea Sánchez, 2022): 3 dimensions, 18 factors,
-- 61 subfactors and the 18 thesis anchors (Table 7, total TC 243 / NS 61).
--
-- This is a DATA migration, so a database created with `prisma migrate deploy`
-- already has the catalog and its anchors without running `db:catalogo`. The
-- same values live in prisma/catalogo.json, which cargar-catalogo.ts uses; keep
-- both sources in sync.
--
-- Every statement is guarded, so running it on a database that already loaded
-- the catalog (or on a re-run) only fills the gaps. The anchors are inserted
-- for every catalog version that does not have them yet, because an anchor is
-- the reference measurement of a factor and later versions inherit it.
--
-- r is not hardcoded: it is the division TC / NS of RN-01, which is exactly
-- what reproduces the quartile cuts 1.86 / 3.65 / 4.78 of version 1.
-- ---------------------------------------------------------------------------

-- 1. Version 1, created by the system (creado_por is null).
INSERT INTO "catalogo_version" ("numero", "creado_por", "motivo", "rq1", "rq2", "rq3")
SELECT
  1,
  NULL,
  'Catálogo validado de la tesis (Rea Sánchez, 2022): 18 factores y 61 subfactores',
  1.86,
  3.65,
  4.78
WHERE NOT EXISTS (SELECT 1 FROM "catalogo_version");

-- 2. Dimensions of the global catalog.
INSERT INTO "dimension" ("nombre", "id_proyecto")
SELECT d.nombre, NULL
FROM (VALUES ('Tecnológica'), ('Organizacional'), ('Económica')) AS d(nombre)
WHERE NOT EXISTS (
  SELECT 1
  FROM "dimension" x
  WHERE x."nombre" = d.nombre AND x."id_proyecto" IS NULL
);

-- 3. Factors with the IS of the thesis (IE = 3, so IS comes from the survey).
INSERT INTO "factor" (
  "id_dimension", "nombre", "sugerida_default", "alcance_default",
  "origen", "is_origen", "validado_expertos", "activo"
)
SELECT
  dim."id", d.nombre, d.sugerida, d.alcance::text::"Alcance",
  'tesis', 'tesis', true, true
FROM (VALUES
  ('Tecnológica', 'Compatibilidad', 3, 'externo'),
  ('Tecnológica', 'Personalización', 3, 'externo'),
  ('Tecnológica', 'Prueba', 3, 'externo'),
  ('Tecnológica', 'Fiabilidad', 3, 'externo'),
  ('Tecnológica', 'Reusabilidad', 2, 'externo'),
  ('Tecnológica', 'Usabilidad', 3, 'externo'),
  ('Tecnológica', 'Mantenibilidad', 3, 'externo'),
  ('Tecnológica', 'Portabilidad', 2, 'externo'),
  ('Tecnológica', 'Documentación', 2, 'externo'),
  ('Organizacional', 'Formación', 3, 'interno'),
  ('Organizacional', 'Tiempo de adopción', 2, 'interno'),
  ('Organizacional', 'Casos de estudio de adopción FLOSS', 2, 'externo'),
  ('Organizacional', 'Centralidad de la tecnología de la información', 2, 'interno'),
  ('Organizacional', 'Apoyo de la alta dirección', 2, 'interno'),
  ('Organizacional', 'Bloqueo de proveedores', 2, 'externo'),
  ('Organizacional', 'Soporte', 3, 'externo'),
  ('Organizacional', 'Actitud hacia el cambio', 2, 'interno'),
  ('Económica', 'Coste total de propiedad', 3, 'interno')
) AS d(dimension, nombre, sugerida, alcance)
JOIN "dimension" dim
  ON dim."nombre" = d.dimension AND dim."id_proyecto" IS NULL
WHERE NOT EXISTS (
  SELECT 1
  FROM "factor" f
  WHERE f."nombre" = d.nombre AND f."id_dimension" = dim."id"
);

-- 4. Subfactors, only for a factor that still has none. The guard is evaluated
--    once per factor (the subquery cannot see the rows of the same statement).
INSERT INTO "subfactor" ("id_factor", "texto")
SELECT f."id", d.texto
FROM (VALUES
  ('Compatibilidad', 'Una empresa proporciona una infraestructura de nube lista para usar para este software'),
  ('Compatibilidad', 'Los programas informáticos pueden exportar formatos propietarios'),
  ('Compatibilidad', 'El software interactúa y se integra con el software propietario existente'),
  ('Compatibilidad', 'El software está certificado para operar en su nicho de mercado'),
  ('Compatibilidad', 'El software es compatible con los casos de uso y las funcionalidades más comunes'),
  ('Compatibilidad', 'El software es compatible con múltiples componentes de hardware'),
  ('Compatibilidad', 'El software utiliza formatos estándar'),
  ('Compatibilidad', 'El software es compatible con varios sistemas operativos diferentes (el software es multiplataforma)'),
  ('Personalización', 'El acceso al código fuente es un incentivo para la organización'),
  ('Personalización', 'El software se puede ampliar fácilmente para satisfacer las necesidades de la organización modificando el código fuente'),
  ('Personalización', 'Las innovaciones se introducen en el software a un ritmo rápido'),
  ('Personalización', 'El software es fácil de personalizar sin necesidad de modificar el códigofuente'),
  ('Personalización', 'El software soporta nuevas funciones a través de módulos (el software es modular)'),
  ('Personalización', 'Hay un repositorio público de extensiones para este software'),
  ('Prueba', 'El software es fácil de desplegar y de probar'),
  ('Fiabilidad', 'El software es fiable y estable'),
  ('Fiabilidad', 'El software tiene un buen historial en cuanto a errores de seguridad (el software es seguro)'),
  ('Fiabilidad', 'El software es más flexible que la solución propietaria'),
  ('Fiabilidad', 'El software es más confiable que la solución propietaria'),
  ('Fiabilidad', 'El programa proporciona una amplia variedad de funciones de control de acceso'),
  ('Reusabilidad', 'La licencia permite extensiones propietarias'),
  ('Reusabilidad', 'El software se ofrece como una biblioteca / marco de trabajo'),
  ('Usabilidad', 'El software proporciona una interfaz gráfica de usuario (GUI)'),
  ('Usabilidad', 'El software es más fácil de usar que la alternativa propietaria'),
  ('Usabilidad', 'El software es fácil de aprender'),
  ('Usabilidad', 'El usuario está descontento con el software propietario'),
  ('Mantenibilidad', 'El software es mantenido activamente por los desarrolladores'),
  ('Portabilidad', 'Una versión de aplicación móvil de este software está disponible'),
  ('Portabilidad', 'El software es una sistemas de administración de base de datos independiente'),
  ('Documentación', 'El software está bien documentado'),
  ('Documentación', 'La documentación de desarrollo cubre todas las características'),
  ('Documentación', 'La documentación está disponible en múltiples formatos'),
  ('Documentación', 'La documentación es fácil de entender'),
  ('Documentación', 'La documentación está actualizada'),
  ('Documentación', 'La documentación está escrita por escritores especializados (no desarrolladores)'),
  ('Documentación', 'La documentación del software es de alta calidad'),
  ('Documentación', 'El software viene con documentación de desarrollo'),
  ('Documentación', 'El software viene con documentación de usuario'),
  ('Documentación', 'La documentación del usuario cubre todas las características'),
  ('Documentación', 'Los formatos de datos están bien documentados'),
  ('Formación', 'La adopción de este software permite a los usuarios mejorar las habilidades técnicas de TI'),
  ('Formación', 'El personal de la organización puede aprender fácilmente por sí mismo a utilizar este software'),
  ('Formación', 'El personal de la organización está capacitado para resolver problemas tecnológicos'),
  ('Formación', 'Los planes de entrenamiento de este software están disponibles'),
  ('Tiempo de adopción', 'Los requisitos de instalación y despliegue del software son fáciles de cumplir'),
  ('Tiempo de adopción', 'El tiempo requerido para adoptar este software es bajo'),
  ('Casos de estudio de adopción FLOSS', 'Hay informes públicos disponibles en Internet que describen el éxito de la adopción de este software'),
  ('Centralidad de la tecnología de la información', 'La adopción de este software mejora el entorno de trabajo de los usuarios'),
  ('Centralidad de la tecnología de la información', 'Centralizar la infraestructura de TI ayuda a acelerar la adopción de este software'),
  ('Apoyo de la alta dirección', 'La alta dirección apoya la adopción exitosa de este software'),
  ('Bloqueo de proveedores', 'El software reduce las dependencias de los proveedores en su entorno'),
  ('Soporte', 'El soporte de la comunidad para este software está disponible'),
  ('Soporte', 'Soporte de expertos y consultores externos para consultas específicas está disponible'),
  ('Soporte', 'El soporte comercial de este software está disponible 24/7/365'),
  ('Soporte', 'Hay desarrolladores en su organización que saben cómo desarrollar este software'),
  ('Soporte', 'Soporte comercial para la personalización de software está disponible'),
  ('Soporte', 'Es fácil contratar personal informático en la comunidad que conozca este software'),
  ('Actitud hacia el cambio', 'El personal de la organización muestra poca resistencia al cambio tecnológico'),
  ('Actitud hacia el cambio', 'El personal técnico encargado del despliegue y soporte en la organización respalda la adopción de este software'),
  ('Coste total de propiedad', 'Es poco probable que haya costos ocultos al adoptar este software'),
  ('Coste total de propiedad', 'La adopción de este software es menos costosa que la alternativa patentada')
) AS d(factor, texto)
JOIN "factor" f ON f."nombre" = d.factor
JOIN "dimension" dim
  ON dim."id" = f."id_dimension" AND dim."id_proyecto" IS NULL
WHERE NOT EXISTS (
  SELECT 1 FROM "subfactor" s WHERE s."id_factor" = f."id"
);

-- 5. Thesis anchors (Table 7, 2008-2019) for every catalog version that still
--    lacks them. Conflict target is the unique index on (id_factor, id_catalogo_version).
INSERT INTO "medicion_ancla" (
  "id_factor", "id_catalogo_version", "terminos_busqueda",
  "periodo_desde", "periodo_hasta", "citas", "ns", "r"
)
SELECT
  f."id",
  v."id",
  '{}'::jsonb,
  2008,
  2019,
  d.tc,
  d.ns,
  d.tc::double precision / d.ns::double precision
FROM (VALUES
  ('Compatibilidad', 8, 33),
  ('Personalización', 6, 30),
  ('Prueba', 1, 4),
  ('Fiabilidad', 5, 19),
  ('Reusabilidad', 2, 5),
  ('Usabilidad', 4, 14),
  ('Mantenibilidad', 1, 4),
  ('Portabilidad', 2, 4),
  ('Documentación', 11, 20),
  ('Formación', 4, 27),
  ('Tiempo de adopción', 2, 2),
  ('Casos de estudio de adopción FLOSS', 1, 1),
  ('Centralidad de la tecnología de la información', 2, 2),
  ('Apoyo de la alta dirección', 1, 5),
  ('Bloqueo de proveedores', 1, 3),
  ('Soporte', 6, 43),
  ('Actitud hacia el cambio', 2, 3),
  ('Coste total de propiedad', 2, 24)
) AS d(nombre, ns, tc)
JOIN "factor" f ON f."nombre" = d.nombre
JOIN "dimension" dim
  ON dim."id" = f."id_dimension" AND dim."id_proyecto" IS NULL
CROSS JOIN "catalogo_version" v
WHERE d.ns > 0
ON CONFLICT ("id_factor", "id_catalogo_version") DO NOTHING;
