# Feature: módulos núcleo de GUIOS PRO

Desarrollo de la mayor parte del sistema antes de repartirlo al equipo, en dos sesiones
sincronizadas por el contrato `docs/api-contract.md`. Rama `feat/modulos-nucleo`.

## Specs

- S1. Usuario: "antes de pasarle al equipo quiero q sigamos avanzando para q ellos hagan menos así q trabaja con la sesion 2 y desarrollen un plan para q de manera optima sin gastar demasiados tokens , trabajando de manera muy perfecta y sincronizada avancemoz con el desarrollo de la mayor parte del sistema"
- S2. Contrato de la API: `docs/api-contract.md` (A1 a A6). La API lo implementa y la web lo consume; cualquier cambio pasa por el dueño de la API.
- S3. Jurado es un rol por proyecto: "un coorinador puede enviar una solicitud a un usuario para q se convierta en jurado de un proyecto" (L14 de base-sistema).
- S4. El administrador no crea proyectos (L16 de base-sistema). Permisos en el servidor (RNF-08); proyectos cerrados inmutables (RNF-09).
- S5. Cálculos solo con `@guios/calculo` (RNF-03).

## Tasks

| ID | Specs | Tarea | Ruta | Estado | Commit |
| --- | --- | --- | --- | --- | --- |
| A1 | S2, S4 | API: organizaciones, usuarios (admin), parámetros | sesión 1 | hecha | f52f836 |
| A2 | S2 | API: catálogo de lectura y carga desde JSON | sesión 1 | hecha | bc8f400 |
| A3 | S2, S3, S4 | API: proyectos, softwares, jurados, solicitudes, guard de acceso | sesión 1 | hecha | f618fa6 |
| A4 | S2, S5 | API: importancias y calificaciones del jurado | sesión 1 | hecha | 89345b3 |
| A5 | S2, S5 | API: consolidación y alcance | sesión 1 | hecha | 89345b3 |
| A6 | S2, S5 | API: resultados, banderas, resultado personal, auditoría | sesión 1 | hecha | 69b3960 |
| W1 | S2 | Web: Configuración (parámetros, usuarios y roles, organizaciones) | sesión 2 | hecha | ca88fdb |
| W2 | S2, S3 | Web: Inicio, Mis evaluaciones, Nuevo proyecto, detalle con softwares y jurados, solicitudes | sesión 2 | hecha | 26e7542 |
| W3 | S2 | Web: Catálogo de factores (lectura) | sesión 2 | pendiente | |
| W4 | S2 | Web: pasos 1 a 4 del jurado (importancia y calificación con guardado inmediato) | sesión 2 | hecha | 7ddfbdc |
| W5 | S2 | Web: Consolidación y alcance | sesión 2 | hecha | 92a6f6b |
| W6 | S2 | Web: Resultado, Comparación y Auditoría | sesión 2 | pendiente | |

Quedan para el equipo: exportar PDF (RF-19), análisis con IA (RF-16), estimación de IS con IA y
edición o versionado del catálogo (RF-18, RF-22 a RF-24), recuperar contraseña (RF-25).

## Log

- L1 (usuario): ver S1.
- L2 (decisión): división por capa y no por módulo: sesión 1 es dueña de `apps/api/**` y `docs/api-contract.md`; sesión 2 de `apps/web/**`. Así no comparten archivos y la sincronización es el contrato. Cada sesión hace commit solo de sus rutas (`git add -- <ruta> && git commit -- <ruta>`); nadie hace push.
- L3 (bloqueo de datos): el PDF no trae los 18 factores y 63 subfactores de la tesis; la carga del catálogo lee un JSON que tiene que proveer el usuario. Las pruebas usan datos sintéticos.
- L4 (avance): API completa contra el contrato (A1-A6), 125 e2e + 4 unitarias en verde. Cargador del catálogo listo; el JSON real de la tesis lo provee el usuario.
- L5 (usuario): "perfecto lo dejé tood en la carpecta de docs revisa y recuerda q la is es calculada automaticamente por una \"ia\"". Fuentes en docs/ (factors.csv, guiosad_data.csv, guiosad.py del prototipo, matriz xlsx, manual técnico). Aclarado al usuario: según la sección 6 la IA estima citas y el código calcula la IS; los 18 factores de la tesis entran con su IS original (is_origen = tesis).
- L6 (decisión, usuario: "prfecto hazlo"): "Soporte" viene con alcance "Ambos", que RN-09 no define; se carga como externo y el coordinador puede reclasificarlo por proyecto (RF-07). El catálogo real tiene 61 subfactores, no 63 como dice el PDF; coincide con los ejemplos de la spec (Documentación 11, Compatibilidad 8, Usabilidad 4). Cargado en guios como versión 1.
- L7 (revisión): revisión nativa de A3 (f618fa6) aprobada con 8 hallazgos no bloqueantes. Se corrige la carrera al invitar dos veces al mismo jurado (500 en vez de 409). Se aceptan por diseño: buscar usuario por correo exacto permite saber si un correo existe (necesario para invitar), y un jurado invitado ve los datos básicos del proyecto antes de aceptar. La rama completa excedía el presupuesto de revisión: se revisa por commits.
