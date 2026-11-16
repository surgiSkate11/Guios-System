# Guía de despliegue de GUIOS PRO

GUIOS PRO se despliega como tres piezas: una base PostgreSQL, la API NestJS (proceso Node) y la
web (archivos estáticos). Un servidor web sirve la web y reenvía `/api` a la API, así el navegador
ve un solo origen y no hace falta configurar CORS.

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

Opcionales: `IA_PROVEEDOR`, `IA_API_KEY`, `IA_MODELO`, `IA_MODELOS_RESPALDO`, `SMTP_*`,
`OPENALEX_MAILTO`, `AUTH_RATE_LIMIT`. Sin IA, el análisis usa el texto de respaldo; sin SMTP, los
correos se escriben en el registro de la API.

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

## 7. Actualizar a una versión nueva

```bash
git pull
npm ci
npm run build
npm run db:deploy -w @guios/api
# reiniciar el servicio de la API
```

## 8. Respaldo y restauración

```bash
pg_dump -U guios -Fc guios > guios-$(date +%F).dump
pg_restore -U guios -d guios --clean guios-AAAA-MM-DD.dump
```

Programar el respaldo diario y guardar copias fuera del servidor.

## 9. Lista de verificación

- [ ] `JWT_SECRET` propio y de al menos 32 caracteres.
- [ ] Contraseña del administrador cambiada después del primer ingreso.
- [ ] HTTPS activo y `WEB_URL` con el dominio real.
- [ ] `GET /api/health` responde `ok` a través del dominio.
- [ ] Respaldo diario configurado.
