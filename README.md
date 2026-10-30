# GUIOS PRO

Web application that evaluates one or more candidate software products against an
organization's requirement, with one or more judges. Full specification:
[`doc/GUIOS PRO especificación de requerimientos.pdf`](doc/). Prototype screens:
`doc/img prototipo/`.

## Structure

| Path | Purpose |
| --- | --- |
| `packages/calculo` | `@guios/calculo`: calculation rules RN-01 to RN-14, shared by API and web |
| `apps/api` | `@guios/api`: NestJS REST API, every route under `/api`; Prisma + PostgreSQL |
| `apps/web` | `@guios/web`: React + Vite + Tailwind frontend |
| `doc/` | Requirements specification and prototype screens |
| `odd/tasks/` | Feature tracking documents |

## Requirements

- Node.js 22 or newer, npm 10 (workspaces)
- PostgreSQL 17 or 18 running locally

## First-time setup

1. Install dependencies (also generates the Prisma client):
   ```bash
   npm install
   ```
2. Create an empty database, for example `guios`:
   ```bash
   psql -U postgres -c "CREATE DATABASE guios;"
   ```
3. Create `apps/api/.env` (ignored by git) with the variables below.
4. Apply the migrations and create the default administrator:
   ```bash
   npm run db:deploy -w @guios/api
   npm run db:seed -w @guios/api
   ```
5. Run the API and the web in two terminals:
   ```bash
   npm run start:dev -w @guios/api   # http://localhost:3000/api/health
   npm run dev -w @guios/web         # http://localhost:5173 (proxies /api to the API)
   ```
6. Sign in at http://localhost:5173/login with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

## API environment (`apps/api/.env`)

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `PORT` | no | `3000` | HTTP port of the API |
| `DATABASE_URL` | yes | — | `postgresql://USER:PASSWORD@localhost:5432/guios?schema=public` (URL-encode special characters in the password: `@` → `%40`) |
| `JWT_SECRET` | yes | — | Signing key for access tokens, at least 32 characters. Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `ADMIN_EMAIL` | for the seed | — | Email of the default administrator (RF-01) |
| `ADMIN_PASSWORD` | for the seed | — | Initial password of the default administrator |

## Commands

```bash
npm test            # every workspace: calculo, api (unit + e2e), web
npm run build       # every workspace
npm run typecheck   # every workspace

npm run db:migrate -w @guios/api    # create and apply a migration after editing prisma/schema.prisma
npm run db:deploy -w @guios/api     # apply pending migrations
npm run db:seed -w @guios/api       # create the default administrator (idempotent)
npm run db:generate -w @guios/api   # regenerate the Prisma client
```

### Test database

The API e2e tests never touch your development database. They derive a second URL from
`DATABASE_URL` with the database name replaced by `guios_test`, create that database if
needed, apply every migration to it and empty its tables between tests. The PostgreSQL
user in `DATABASE_URL` therefore needs permission to create databases.

## API endpoints so far

| Method and path | Access | Purpose |
| --- | --- | --- |
| `GET /api/health` | public | Health check |
| `POST /api/auth/registro` | public | Self sign-up; always creates role `invitado` |
| `POST /api/auth/login` | public | Returns `{ accessToken, usuario }` |
| `GET /api/auth/me` | any signed-in user | Current user |
| `GET /api/usuarios` | `administrador` | List users |

Every other route requires `Authorization: Bearer <token>` by default; open a route with
`@Public()` and restrict it with `@Roles(...)` (`apps/api/src/auth/decorators.ts`).
