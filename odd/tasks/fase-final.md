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

## Log

- L1 (usuario): ver S1. Commits con `--no-verify` (salta los hooks); las pruebas se siguen corriendo antes de cada commit.
- L2 (decisión): proveedor de IA detrás de una interfaz; implementación con la API de Anthropic configurada por `.env` (`IA_API_KEY`, `IA_MODELO`). Sin clave, análisis usa texto de respaldo y la estimación con IA responde 409. Servicio bibliográfico: OpenAlex.
- L3 (revisión): revisión nativa de B1 (64bcd22) aprobada; se corrigió que restablecer invalide los demás enlaces pendientes (revisión aprobada sin hallazgos). Deuda anotada, no bloqueante: el límite de intentos es por IP (puede afectar a usuarios detrás de la misma red), sin SMTP el enlace se imprime en la consola (solo desarrollo), un JWT emitido antes del cambio de contraseña sigue vigente hasta vencer (8 h) y el tiempo de respuesta de /recuperar difiere si el correo existe.
- L4 (revisión): revisión nativa de feat/fase-final por commit (la rama entera excedía el presupuesto). Todos aprobados: 64bcd22 + 963b6dc, 63c5f56, 57f901e, 99b3486, e88fee7, bbfde37, dfe4bc8. Avisos no bloqueantes para el equipo: aprobar una estimación puede competir con otra aprobación simultánea (sin bloqueo optimista); PATCH de factor no valida contra estimaciones abiertas; GET /analisis visible a jurados; rutas reales de IA sin prueba con un modelo real; una estimación queda en_curso si el proceso se reinicia; la web oculta el botón PDF ante un error transitorio y deja de consultar el avance de la estimación ante un error de red.
