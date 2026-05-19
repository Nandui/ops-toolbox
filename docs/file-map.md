# File Map

This is the quickest route map for new contributors or AI agents.

## Root files

- `README.md` — entry point and setup
- `package.json` — scripts and dependencies
- `next.config.ts` — Next.js output mode and config
- `tsconfig.json` — TypeScript settings and path aliases
- `Dockerfile` — container build/run recipe
- `docker-compose.yml` — local container orchestration
- `scripts/start-standalone.js` — standalone server bootstrap

## App routes

### Public

- `src/app/page.tsx` — redirects `/` to `/dashboard`
- `src/app/login/page.tsx` — login form

### Dashboard shell

- `src/app/dashboard/layout.tsx` — protected shell layout
- `src/components/auth/AuthProvider.tsx` — client auth hydration
- `src/components/shell/Sidebar.tsx` — navigation rail
- `src/components/shell/TopBar.tsx` — account bar

### Dashboard pages

- `src/app/dashboard/page.tsx` — overview landing page
- `src/app/dashboard/chemistry/page.tsx` — pool chemistry dashboard
- `src/app/dashboard/tasks/page.tsx` — Trail task board
- `src/app/dashboard/scores/page.tsx` — Trail site scores
- `src/app/dashboard/incidents/page.tsx` — incident list / feed
- `src/app/dashboard/incidents/loading.tsx` — loading state
- `src/app/dashboard/handovers/page.tsx` — handover notes
- `src/app/dashboard/admin/users/page.tsx` — admin user table
- `src/app/dashboard/admin/settings/page.tsx` — admin settings table

## API routes

### Auth

- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/me/route.ts`
- `src/app/api/auth/logout/route.ts`

### Admin

- `src/app/api/admin/users/route.ts`
- `src/app/api/admin/settings/route.ts`

### Trail

- `src/app/api/trail/chemistry/route.ts`
- `src/app/api/trail/tasks/route.ts`
- `src/app/api/trail/scores/route.ts`
- `src/app/api/trail/incidents/route.ts`
- `src/app/api/trail/handovers/route.ts`

### Notion

- `src/app/api/notion/incidents/route.ts`

## Shared libraries

- `src/lib/portal.ts` — roles and sites
- `src/lib/auth.ts` — JWT sessions and login lookup
- `src/lib/db/index.ts` — SQLite schema and seeds
- `src/lib/trail/client.ts` — Trail HTTP client and types
- `src/lib/trail/cache.ts` — Trail cache/date helpers
- `src/lib/notion/incidents.ts` — Notion incident integration
- `src/lib/utils.ts` — shared UI utility helpers

## UI primitives

- `src/components/ui/*` — generated base components

## Data directory

- `data/app.db` — local SQLite database

## If you need X, read Y first

- **Need to change login/session behavior?** → `src/lib/auth.ts`
- **Need to add a site or role?** → `src/lib/portal.ts`
- **Need to change Trail caching?** → `src/lib/trail/cache.ts`
- **Need to change Trail API calls?** → `src/lib/trail/client.ts`
- **Need to change incident fields?** → `src/lib/notion/incidents.ts`
- **Need to change default seed data?** → `src/lib/db/index.ts`
- **Need to change the shell/navigation?** → `src/components/shell/*`
