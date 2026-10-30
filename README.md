# GUIOS PRO

Web application that evaluates one or more candidate software products against an
organization's requirement, with one or more judges. Full specification:
[`doc/GUIOS PRO especificación de requerimientos.pdf`](doc/).

## Structure

| Path | Purpose |
| --- | --- |
| `packages/calculo` | `@guios/calculo`: calculation rules RN-01 to RN-14, shared by API and web |
| `apps/api` | NestJS REST API (pending) |
| `apps/web` | React + Vite frontend (pending) |
| `doc/` | Requirements specification |

## Requirements

- Node.js 22 or newer
- npm 10 (workspaces)

## Commands

```bash
npm install         # install all workspaces
npm run build       # build every workspace
npm run typecheck   # type-check every workspace
npm test            # run every workspace's tests
```
