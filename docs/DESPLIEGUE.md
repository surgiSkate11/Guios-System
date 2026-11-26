# Guía de despliegue de GUIOS PRO

Para la demo, despliega PostgreSQL y la API NestJS en Render y los archivos estáticos de React/Vite
en Vercel. Al usar dominios distintos, configura `VITE_API_URL` en Vercel y `WEB_URL` en Render
para que la web pueda llamar a la API.

## 1. Requisitos del servidor

- Node.js 22 o superior y npm 10.
- PostgreSQL 17 o 18.
- Un servidor web o proxy inverso (por ejemplo Nginx o Caddy) con HTTPS.
- Salida a Internet si se usan la IA (Gemini), OpenAlex o el correo SMTP.

## 2. Base de datos

```bash
psql -U postgres -c "CREATE USER guios WITH PASSWORD '<contraseña segura>';"
psql -U postgres -c "CREATE DATABASE guios OWNER guios;"
```

## 3. Variables de entorno

Crear `apps/api/.env` en el servidor (nunca se sube a git). Las variables están documentadas en el
`README.md`. Valores mínimos de producción:

```
PORT=3000
DATABASE_URL="postgresql://guios:<contraseña>@localhost:5432/guios?schema=public"
JWT_SECRET="<48 bytes aleatorios en base64url>"
ADMIN_EMAIL="admin@<dominio>"
ADMIN_PASSWORD="<contraseña inicial, cambiarla después>"
WEB_URL="https://<dominio>"
```

Opcionales: `IA_PROVEEDOR`, `IA_API_KEY`, `IA_MODELO`, `IA_MODELOS_RESPALDO`, `IA_TOKENS_LIMITE`,
`SMTP_*`, `OPENALEX_MAILTO`, `AUTH_RATE_LIMIT`. El límite de IA predeterminado es 900.000 tokens
combinados en una ventana móvil de 7 días; cuando se agota, se bloquean nuevas llamadas antes de
contactar al proveedor y la sugerencia de IS conserva los valores de tesis. El consumo se guarda en
PostgreSQL y sobrevive reinicios. Sin IA configurada, el análisis usa el texto de respaldo; sin SMTP,
los correos se escriben en el registro de la API.

El límite de tokens no garantiza por sí solo un costo de $0: las tarifas dependen del proveedor y
de su cuenta. Para la demo gratuita usa Gemini con un plan/cuota gratuita, no habilites facturación
de pago y recuerda que la búsqueda web de Google está desactivada para la sugerencia de IS.

## 4. Compilar e instalar

```bash
git clone https://github.com/surgiSkate11/Guios-System.git
cd Guios-System
npm ci
npm run build                          # calculo, api y web
npm run db:deploy -w @guios/api        # esquema y catálogo de la tesis
npm run db:seed -w @guios/api          # administrador por defecto
```

El resultado:
- API: `apps/api/dist/main.js`.
- Web: `apps/web/dist/` (archivos estáticos).

## 5. Ejecutar la API

```bash
NODE_ENV=production npm run start:prod -w @guios/api
```

Conviene mantenerla como servicio (systemd, PM2 o el servicio de la plataforma) para que se
reinicie sola. Comprobación: `GET /api/health` responde `{"status":"ok"}`.

## 6. Servir la web y la API en el mismo dominio

Ejemplo con Nginx:

```nginx
server {
    server_name <dominio>;
    root /ruta/a/Guios-System/apps/web/dist;

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;   # la estimación con IA puede tardar
    }

    # La web es una SPA: toda ruta que no sea un archivo vuelve a index.html.
    location / {
        try_files $uri /index.html;
    }
}
```

Activar HTTPS (por ejemplo con Certbot) antes de abrirlo a los usuarios.

## 7. Desplegar gratis en Vercel y Render

Para una demo de siete días, elige los planes **Hobby/Free** y verifica que no se active un plan de
pago. Render Free duerme la API tras 15 minutos sin tráfico y su PostgreSQL Free expira a los 30
días; consulta los [límites vigentes de Render](https://render.com/docs/free). Vercel necesita
una regla SPA, incluida en `vercel.json` en la raíz del repositorio.

Antes de crear los servicios, confirma que los cambios que quieres publicar estén subidos a la
rama de GitHub que seleccionarás: ambos proveedores construyen desde el repositorio.

### A. Crear la base de datos y la API en Render

1. En Render, crea PostgreSQL con **New → PostgreSQL**, plan **Free** y la región donde alojarás
   la API. Guarda la **Internal Database URL** para usarla como `DATABASE_URL`.
2. Crea **New → Web Service**, conecta el repositorio y configura:

   | Campo | Valor |
   |---|---|
   | Name | `guios-api` (o uno disponible) |
   | Branch | `main` |
   | Root Directory | Vacío (raíz del repositorio) |
   | Language | `Node` |
   | Region | La misma de PostgreSQL |
   | Build Command | `npm ci && npm run build -w @guios/calculo && npm run build -w @guios/api` |
   | Start Command | `npm run db:deploy -w @guios/api && npm run db:seed -w @guios/api && npm run start:prod -w @guios/api` |
   | Instance Type | `Free` |

3. En **Environment Variables**, agrega:

   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | Internal Database URL de PostgreSQL |
   | `NODE_ENV` | `production` |
   | `JWT_SECRET` | Secreto aleatorio propio, al menos 32 caracteres |
   | `ADMIN_EMAIL` | Correo para la cuenta administradora |
   | `ADMIN_PASSWORD` | Contraseña inicial fuerte |

   Render asigna `PORT` automáticamente. No pongas todavía `WEB_URL`; la añadirás después de
   crear el frontend. Para la demo gratuita, no selecciones un compute pagado ni habilites
   facturación opcional. No compartas ni guardes las URL/secrets en el repositorio.
4. Crea el servicio y espera a que termine el despliegue. Copia su URL pública y comprueba
   `https://<dominio-api>/api/health`; debe responder `{"status":"ok"}`.

### B. Crear el frontend en Vercel

1. En Vercel, importa el mismo repositorio de GitHub y configura el proyecto:

   | Campo | Valor |
   |---|---|
   | Framework Preset | `Vite` |
   | Root Directory | `.` (raíz del repositorio) |
   | Install Command | `npm ci` |
   | Build Command | `npm run build -w @guios/calculo && npm run build -w @guios/web` |
   | Output Directory | `apps/web/dist` |

2. En **Environment Variables**, agrega `VITE_API_URL` con el origen público de Render, por
   ejemplo `https://guios-api.onrender.com` (sin `/api` ni barra al final). Actívala para
   **Production** y **Preview** si usarás ambas. Despliega el proyecto y copia su dominio.
3. Vuelve a Render y agrega `WEB_URL` con el origen exacto de Vercel, por ejemplo
   `https://guios-pro.vercel.app` (sin barra final). Guarda los cambios y espera el redepliegue
   de la API.

`VITE_API_URL` se incorpora al bundle durante la compilación: si cambia, hay que reconstruir el
frontend. Nunca pongas secretos en variables `VITE_*`, porque quedan visibles en el navegador.

### C. Verificar el despliegue

- Abre el dominio Vercel, inicia sesión con `ADMIN_EMAIL` y `ADMIN_PASSWORD` y prueba una ruta
  interna recargando la página.
- Verifica que la web pueda iniciar sesión y cargar datos. Si falla por CORS, confirma que
  `WEB_URL` sea exactamente el origen Vercel, sin ruta ni barra final.
- La API gratuita puede tardar cerca de un minuto en despertar después de estar inactiva.
- Sin SMTP configurado, los correos de recuperación aparecen en el registro de la API.

## 8. Actualizar a una versión nueva

```bash
git pull
npm ci
npm run build
npm run db:deploy -w @guios/api
# reiniciar el servicio de la API
```

## 9. Respaldo y restauración

```bash
pg_dump -U guios -Fc guios > guios-$(date +%F).dump
pg_restore -U guios -d guios --clean guios-AAAA-MM-DD.dump
```

Programar el respaldo diario y guardar copias fuera del servidor.

## 10. Lista de verificación

- [ ] `JWT_SECRET` propio y de al menos 32 caracteres.
- [ ] Contraseña del administrador cambiada después del primer ingreso.
- [ ] HTTPS activo y `WEB_URL` con el dominio real.
- [ ] `GET /api/health` responde `ok` a través del dominio.
- [ ] Respaldo diario configurado.
