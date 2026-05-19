# AI Agent Guide

This document is for other LLMs or autonomous agents that need to understand or modify this portal quickly.

## Start here

Read in this order:

1. `README.md`
2. `docs/architecture.md`
3. `docs/file-map.md`
4. `src/lib/portal.ts`
5. `src/lib/auth.ts`
6. `src/lib/trail/client.ts`
7. `src/lib/notion/incidents.ts`
8. `src/lib/db/index.ts`

## Core source of truth

- **Roles and labels:** `src/lib/portal.ts`
- **Auth/session:** `src/lib/auth.ts`
- **SQLite seed + schema:** `src/lib/db/index.ts`
- **Trail integration:** `src/lib/trail/client.ts`
- **Trail cache helpers:** `src/lib/trail/cache.ts`
- **Notion incident mapping:** `src/lib/notion/incidents.ts`

## Safe-change checklist

Before editing anything, check:

- Does this touch auth, Trail, or Notion?
- Is the change shared between server and client code?
- Is there already a canonical helper or constant?
- Will the build still work in standalone mode?
- Does the change preserve the current login/session behavior?

## Common traps

- **Cookie name drift**
  - The session cookie must stay consistent across login, logout, `me`, proxy, and protected routes.

- **Trail cache duplication**
  - Trail API routes should use the shared cache helper rather than inlining SQLite queries.

- **Role labels duplicated in components**
  - Use `ROLE_LABELS` from `src/lib/portal.ts`.

- **Site IDs hardcoded in multiple places**
  - Use `SITES` from `src/lib/portal.ts`.

- **Standalone runtime mismatch**
  - `npm run start` uses the standalone bootstrap, not `next start`.

## Route map

- `/login` — auth form
- `/dashboard` — overview
- `/dashboard/chemistry` — chemistry dashboard
- `/dashboard/tasks` — Trail task board
- `/dashboard/scores` — Trail scores
- `/dashboard/incidents` — Trail/incident view
- `/dashboard/handovers` — handover view
- `/dashboard/admin/users` — admin user list
- `/dashboard/admin/settings` — admin settings view

## Data flow map

### Login

1. User posts email/password to `/api/auth/login`
2. Server calls `loginUser()`
3. JWT session cookie is created
4. User is redirected to `/dashboard`

### Dashboard shell

1. Client auth provider calls `/api/auth/me`
2. Shell renders sidebar + top bar
3. Protected pages load inside the layout

### Trail-backed pages

1. Page calls its `/api/trail/*` route
2. Route fetches Trail data via `src/lib/trail/client.ts`
3. Result is cached in SQLite (`trail_cache`)
4. Page renders the returned payload

### Incidents

1. Page calls `/api/notion/incidents`
2. Server uses `src/lib/notion/incidents.ts`
3. Active incidents are parsed into a UI-friendly model

## What to edit when...

- **Need a new role or role label:** edit `src/lib/portal.ts`
- **Need auth/session behavior change:** edit `src/lib/auth.ts`
- **Need a new Trail API route:** reuse `src/lib/trail/cache.ts` and `src/lib/trail/client.ts`
- **Need a new dashboard page:** follow the existing shell and page patterns in `src/app/dashboard/*`
- **Need a new Notion field or incident output:** update `src/lib/notion/incidents.ts` first

## Notes for LLMs

- Prefer extracting shared helpers instead of duplicating route logic.
- Keep code comments short and factual.
- Document *why* something exists, not just *what* it does.
- Treat `src/lib/portal.ts` and `src/lib/auth.ts` as canonical shared modules.
