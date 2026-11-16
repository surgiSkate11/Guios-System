# GUIOS PRO

Web application that evaluates one or more candidate software products against an
organization's requirement, with one or more judges, following the GUIOS guide
(Rea Sánchez, 2022). For each software it delivers a SWOT per factor, a 0-100 metric and an
adoption level A, B or C.

Specification: [`doc/GUIOS PRO especificación de requerimientos.pdf`](doc/) ·
Prototype screens: `doc/img prototipo/`.

## Features

- **Accounts and roles**: self sign-up (guest), coordinator and administrator roles, password
  recovery by email, rate-limited authentication.
- **Projects and judges**: projects with several candidate software products, judge invitations
  per project (judge is a per-project role), single-judge mode, closed projects are immutable.
- **Evaluation**: judges rate factor importance and subfactor compliance with immediate saving.
- **Consolidation**: consolidated decision-maker importance (median or mean), relative
  importance, relevance and per-project scope reclassification.
- **Results**: mean weighting, SWOT, metric, adoption level, ranking, ambiguity flags, judge
  audit, personal results and PDF export.
- **AI analysis**: text analysis with recommendations over the SWOT, pseudonymized input,
  number validation and a fallback text when the AI is unavailable.
- **Catalog**: the thesis catalog (18 factors, 61 subfactors, 18 anchors) with versions, factor
  administration, suggested importance (IS) computed live, AI-assisted citation estimation and
  anchor measurement.

Every calculation rule (RN-01 to RN-14) lives in `@guios/calculo` and is shared by the API and
the web.

## Structure

| Path | Purpose |
| --- | --- |
| `packages/calculo` | `@guios/calculo`: calculation rules RN-01 to RN-14, pure TypeScript |
| `apps/api` | `@guios/api`: NestJS REST API under `/api`, Prisma + PostgreSQL |
| `apps/web` | `@guios/web`: React + Vite + Tailwind frontend |
| `docs/api-contract.md` | REST contract between API and web |
| `docs/catalogo-y-anclas.md` | Catalog indicators (TC, NS, r, IL, IS) and anchor measurement |
| `docs/MANUAL-USUARIO.md` | User manual per role |
| `docs/DESPLIEGUE.md` | Production deployment guide |
| `docs/` (other files) | Thesis sources: factors, subfactors, prototype script and technical manual |

## Requirements

- Node.js 22 or newer, npm 10 (workspaces)
- PostgreSQL 17 or 18

## Getting started

1. Install dependencies (also generates the Prisma client):
   ```bash
   npm install
   ```
2. Create an empty database, for example `guios`:
   ```bash
   psql -U postgres -c "CREATE DATABASE guios;"
   ```
3. Create `apps/api/.env` (ignored by git) with the variables below.
4. Apply the migrations (they also load the thesis catalog) and create the default administrator:
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
| `WEB_URL` | no | `http://localhost:5173` | Public web URL used in password-recovery links |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | no | — | Outgoing email. Without `SMTP_HOST` emails are printed in the API console. Gmail: `smtp.gmail.com`, port `587`, the account as user and a 16-character app password (requires 2-step verification) |
| `IA_PROVEEDOR` | no | `gemini` | AI provider: `gemini` (Google AI Studio, has a free tier) or `anthropic` |
| `IA_API_KEY` | no | — | API key of the provider, used by the AI analysis and the AI IS estimation. Without it the analysis uses the fallback text and the AI estimation answers 409. On the Gemini free tier Google may use requests to improve its models; only public abstracts and pseudonymized results are sent |
| `IA_MODELO` | no | `gemini-3.8-flash` (gemini) / `claude-haiku-5-5` (anthropic) | AI model id |
| `IA_MODELOS_RESPALDO` | no | `gemini-3.5-flash` | Gemini only: comma-separated models tried in order when the main one is overloaded (503), rate-limited (429), retired (404) or does not answer within 20 s |
| `OPENALEX_MAILTO` | no | — | Contact email sent to OpenAlex (polite pool) |
| `AUTH_RATE_LIMIT` | no | `10` | Max login, sign-up and recovery requests per minute per client |


## Commands

```bash
npm test            # every workspace: calculo, api (unit + e2e), web
npm run build       # every workspace
npm run typecheck   # every workspace

npm run db:migrate -w @guios/api    # create and apply a migration after editing prisma/schema.prisma
npm run db:deploy -w @guios/api     # apply pending migrations
npm run db:seed -w @guios/api       # create the default administrator (idempotent)
npm run db:catalogo -w @guios/api   # load the thesis catalog from prisma/catalogo.json (idempotent)
npm run db:generate -w @guios/api   # regenerate the Prisma client
```

### Tests

- `packages/calculo`: unit tests of every rule, including the specification examples.
- `apps/api`: unit tests and end-to-end tests over HTTP. The e2e tests never touch your
  development database: they derive a second URL from `DATABASE_URL` with the database name
  `guios_test`, create it if needed, apply every migration and empty its tables between tests,
  so the PostgreSQL user needs permission to create databases. They also run without AI and
  email, whatever `apps/api/.env` configures.
- `apps/web`: component tests with Vitest and Testing Library against a fake API.

## API

The full REST contract is in [`docs/api-contract.md`](docs/api-contract.md). Every route requires
`Authorization: Bearer <token>` unless marked public; open a route with `@Public()` and restrict it
with `@Roles(...)` (`apps/api/src/auth/decorators.ts`). Project routes also check, on the server,
that the user is the project coordinator or one of its judges.

## Deployment

See [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md).
