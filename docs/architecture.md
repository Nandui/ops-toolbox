# Architecture Overview

## Summary

LeisureWorld Portal is a Next.js App Router application with a split architecture:

- **Client dashboard shell** for the UI
- **Server route handlers** for auth and integration work
- **SQLite** for portal-local state and Trail caching
- **Trail API** for operational data
- **Notion API** for incident tracking

The design goal is to stay small, portable, and easy to reason about for both humans and LLMs.

## Runtime model

### Development

- `npm run dev` starts the Next.js dev server.
- `.env.local` is used for local secrets.

### Standalone / production-style local run

- `npm run build`
- `npm run start`

`npm run start` uses `scripts/start-standalone.js`, which loads `.env.local` and starts the standalone server bundle.

## Folder responsibilities

### `src/app`

Route pages and route handlers.

- `src/app/login` — login page
- `src/app/dashboard` — protected dashboard pages
- `src/app/api` — auth, Trail, admin, and Notion APIs

### `src/components`

Shared UI and shell pieces.

- `components/auth` — client auth provider
- `components/shell` — sidebar and top bar
- `components/ui` — generated UI primitives

### `src/lib`

Shared business logic.

- `portal.ts` — roles, sites, and shared portal metadata
- `auth.ts` — JWT session auth
- `db/index.ts` — SQLite schema and seed data
- `trail/client.ts` — Trail API client and shared Trail types
- `trail/cache.ts` — Trail cache/date helpers
- `notion/incidents.ts` — Notion incident integration

## Authentication flow

1. User submits credentials at `/login`
2. `/api/auth/login` validates the user via SQLite
3. A JWT is signed and stored in the `lw_session` cookie
4. `/api/auth/me` validates the cookie and returns the active user
5. The dashboard shell loads only after auth hydration succeeds

### Authorization boundaries

- `admin` can access admin routes
- `operations_manager` can access operational dashboards
- `manager` can access the normal dashboard pages assigned to them

The proxy only checks for the existence of a session cookie for coarse routing. Full identity checks happen in server handlers.

## Data layer

SQLite is used for local portal state, not as the primary operational system.

### Tables

- `users` — portal users and password hashes
- `sites` — portal site metadata
- `trail_cache` — cached Trail responses
- `trail_poll_log` — operational polling history
- `chemistry_thresholds` — chemistry UI thresholds
- `system_settings` — app settings

### Seed behavior

On first boot, the app seeds:

- the standard site list
- chemistry thresholds
- a default admin user if one does not exist
- common system settings

## Trail integration

`src/lib/trail/client.ts` is the only place that should know the Trail base URL, API key header, and raw response shapes.

The route handlers then:

1. choose a date range
2. request Trail data
3. cache the result in SQLite
4. return a normalized payload to the page

### Route cache TTLs

- chemistry — short TTL
- tasks — short TTL
- incidents — medium TTL
- scores — longer TTL

Use `src/lib/trail/cache.ts` for cache access and date defaults.

## Notion integration

`src/lib/notion/incidents.ts` hides the Notion API details.

It is responsible for:

- fetching active incidents
- parsing Notion properties into a UI-friendly shape
- resolving reporter users by email
- creating incident pages

## UI structure

The protected dashboard is a shell:

- sidebar on the left
- top bar on the top
- page content in the main panel

The shell is client-side because the auth provider hydrates the current user from `/api/auth/me`.

## Design conventions

- dark charcoal background
- clearer card separation than pure black
- subtle emerald accent for brand signal
- readable, high-contrast text
- short labels and compact operational surfaces

## Why this architecture exists

The portal is intentionally small:

- easy to deploy
- easy to reason about
- easy to hand to another engineer or AI agent
- easy to migrate later because the operational integrations are separated from UI code
