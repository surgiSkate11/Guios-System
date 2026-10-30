# AGENTS.md — GUIOS PRO

Web app that evaluates candidate software against an organization's requirement
(GUIOS guide, Rea Sánchez 2022). Spec: `doc/GUIOS PRO especificación de requerimientos.pdf`.
Screens: `doc/img prototipo/`. Feature tracking: `odd/tasks/`.

## Layout

- `packages/calculo` — `@guios/calculo`: rules RN-01..RN-14, pure TS, no runtime deps. The only place calculation rules live (RNF-03); API and web import it, never reimplement it.
- `apps/api` — `@guios/api`: NestJS REST API, every route under `/api`. Jest.
- `apps/web` — `@guios/web`: React 19 + Vite 8 + Tailwind 4 + React Router 7. Vitest + Testing Library.

## Commands (run from the repo root)

```bash
npm install
npm test                          # all workspaces (calculo, api unit+e2e, web)
npm run build                     # all workspaces
npm run test -w @guios/calculo    # one workspace
npm run start:dev -w @guios/api   # http://localhost:3000/api/health
npm run dev -w @guios/web         # http://localhost:5173, proxies /api -> :3000
npx oxlint                        # web lint (run inside apps/web)
npx eslint "{src,test}/**/*.ts"   # api lint (run inside apps/api)
```

`@guios/calculo` is consumed from `dist/`: run `npm run build -w @guios/calculo` after changing it.

## Conventions

- Domain identifiers in Spanish, matching the spec and data model (`importanciaSugerida`, `proyecto_evaluacion`); code comments in English. UI copy in Spanish.
- Test first: each rule or behavior gets a failing test before the code.
- Permissions are enforced on the server (RNF-08); hiding UI is never enough.
- Secrets only in `apps/api/.env` (git-ignored). Variables are documented in `README.md`.
- Commits: Conventional Commits in Spanish (`feat(calculo): ...`), one logical change each.
- Windows host: one Vite copy for the whole monorepo (root devDependency). Keep Vitest/Vite versions aligned.
