# Manual de usuario de GUIOS PRO

GUIOS PRO evalúa uno o varios softwares candidatos frente a un requerimiento de una
organización. Cada software termina con un FODA por factor, una métrica de 0 a 100 y un nivel de
adopción A, B o C.

## Roles

| Rol | Cómo se obtiene | Qué puede hacer |
| --- | --- | --- |
| Invitado | Al registrarse en `/registro` | Ver su panel y aceptar invitaciones para ser jurado |
| Jurado | El coordinador lo invita a un proyecto y el usuario acepta | Asignar importancias, calificar subfactores y ver su resultado en ese proyecto |
| Coordinador | Lo asigna el administrador (requiere organización) | Crear proyectos, invitar jurados, consolidar, generar resultados, comparar, analizar con IA, auditar y cerrar |
| Administrador | Cuenta creada al instalar | Gestionar usuarios, organizaciones, parámetros y el catálogo de factores |

Jurado es un rol **por proyecto**: un mismo usuario puede ser coordinador de un proyecto y jurado
de otro.

## Acceso

- **Iniciar sesión**: `/login` con correo y contraseña.
- **Crear cuenta**: `/registro`. La cuenta nueva queda como invitado.
- **Olvidé mi contraseña**: `/recuperar`. Llega un enlace por correo que vence en 30 minutos y
  sirve una sola vez.

## Administrador

1. **Configuración** (`/admin/configuracion`):
   - *Parámetros de análisis*: umbrales de las banderas, umbral FODA y método de consolidación
     por defecto.
   - *Usuarios y roles*: asignar el rol de coordinador (con su organización) o desactivar cuentas.
   - *Organizaciones*: crear, editar y desactivar organizaciones.
2. **Catálogo de factores** (`/admin/catalogo`): consultar las dimensiones, factores, subfactores,
   anclas, cortes y versiones del catálogo.
   - *Nuevo factor*: escribir los subfactores y sus citas; la IS se calcula en vivo. Al guardar
     queda como propuesta.
   - *Estimar con IA* (opcional): la IA busca artículos 2020-2025 y propone las citas; el sistema
     calcula la IS.
   - *Aprobar o rechazar* la estimación. Aprobar publica una versión nueva del catálogo; los
     proyectos existentes conservan su versión.
   - *Administrar factores*: editar nombre y alcance, desactivar o reactivar factores y
     subfactores.
   - *Medir anclas*: mide con el mismo método los factores que todavía no tienen ancla y
     recalcula los cortes.

## Coordinador

1. **Nuevo proyecto** (`/proyectos/nuevo`): nombre, fechas, dimensiones a evaluar, método de
   consolidación y softwares candidatos.
2. **Jurados**: en el detalle del proyecto, buscar al usuario por correo e invitarlo. Si el
   coordinador se agrega a sí mismo, el proyecto funciona en modo de un solo jurado.
3. **Iniciar el proyecto**: pasa a *en curso* cuando tiene al menos un software y un jurado.
4. **Consolidación y alcance** (`/evaluaciones/consolidacion`): cuando todos los jurados
   registraron sus importancias, revisar la ID consolidada, la IR y la relevancia, reclasificar el
   alcance si hace falta (con justificación) y **confirmar**.
5. **Comparación** (`/evaluaciones/comparacion`): ver la vista previa, generar los resultados,
   revisar el ranking, la métrica por jurado y las banderas, y **exportar el PDF**.
6. **Análisis con IA** (`/evaluaciones/analisis`): generar un texto de análisis con
   recomendaciones sobre el FODA. Si la IA no está disponible se muestra un texto de respaldo.
7. **Auditoría de jurados** (`/evaluaciones/auditoria`): importancias, porcentaje de
   "Desconozco" y puntaje de cada jurado.
8. **Cerrar el proyecto**: con los resultados generados. Un proyecto cerrado ya no se puede
   modificar y queda en el **Historial**.

## Jurado

1. **Aceptar la invitación** desde *Pendientes* en el Inicio.
2. **Pasos 1 y 2 · Importancia**: asignar a cada factor una importancia de 1 a 4. Se guarda al
   instante.
3. **Pasos 3 y 4 · Calificar subfactores**: después de la consolidación, calificar cada subfactor
   de los factores relevantes, por software, de 1 a 4 o marcar *Desconozco*. La PM del factor se
   actualiza al instante.
4. **Pasos 5 y 6 · Resultado**: cuando el coordinador genera los resultados, ver el puntaje y el
   FODA propios.

## Escalas

| Escala | Valores |
| --- | --- |
| Importancia | 1 Irrelevante, 2 Opcional, 3 Importante, 4 Fundamental |
| Calificación de subfactor | 1 No cumple, 2 Cumple mínimamente, 3 Cumple parcialmente, 4 Cumple, o Desconozco |
| Nivel de adopción | A: todos los factores relevantes son fortaleza u oportunidad · B: debilidades o amenazas solo en factores con IR 2 · C: alguna debilidad o amenaza en un factor con IR 3 o 4 |
