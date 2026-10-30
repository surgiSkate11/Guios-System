# GUIOS PRO

Web application that evaluates one or more candidate software products against an
organization's requirement, with one or more judges. Full specification:
[`doc/GUIOS PRO especificación de requerimientos.pdf`](doc/).

## Structure

| Path | Purpose |
| --- | --- |
| `packages/calculo` | `@guios/calculo`: calculation rules RN-01 to RN-14, shared by API and web |
| `apps/api` | `@guios/api`: NestJS REST API, every route under `/api` |
| `apps/web` | `@guios/web`: React + Vite + Tailwind frontend |
| `doc/` | Requirements specification and prototype screens (`doc/img prototitpo/`) |

## Requirements

- Node.js 22 or newer
- npm 10 (workspaces)

## Commands

```bash
npm install         # install all workspaces
npm run build       # build every workspace
npm run typecheck   # type-check every workspace
npm test            # run every workspace's tests

npm run start:dev -w @guios/api   # API in watch mode on http://localhost:3000/api
npm run dev -w @guios/web         # web on http://localhost:5173 (proxies /api to the API)
```

## API environment

Create `apps/api/.env` (ignored by git) with these variables:

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `PORT` | no | `3000` | HTTP port of the API |

Health check: `GET /api/health` returns `{"status":"ok"}`.
