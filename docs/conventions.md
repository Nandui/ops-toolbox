# Conventions

## General style

- Prefer small, focused modules.
- Prefer shared constants over duplicated literals.
- Prefer explicit names over clever shortcuts.
- Comment only where the reason is not obvious from code.

## Auth/session

- The session cookie name is canonical and must not drift.
- Auth checks should happen server-side whenever possible.
- Client auth hydration is for UX, not for security boundaries.

## Roles

- Keep role names in `src/lib/portal.ts`.
- Keep role labels in the same file.
- Do not duplicate role maps inside pages.

## Sites

- Keep portal site IDs and names in `src/lib/portal.ts`.
- Use the shared site list to drive UI labels and filter options.
- Avoid hardcoding site names in pages.

## Trail API

- `src/lib/trail/client.ts` owns the HTTP details.
- `src/lib/trail/cache.ts` owns cache read/write helpers.
- Route handlers should focus on domain logic, not SQLite boilerplate.

## Notion

- `src/lib/notion/incidents.ts` owns property mapping and parsing.
- The API route should only validate input and call the integration helper.

## UI layout

- The portal should stay dark/charcoal, not pure black.
- Cards should visibly separate from the page background.
- Text should prioritize readability over decorative contrast.

## AI-friendly code comments

When commenting code for future agents, prefer this structure:

- **Why this exists**
- **What it depends on**
- **What breaks if changed**

Avoid long narrative comments or repeating the code in prose.

## File naming

- Use `page.tsx` for routes.
- Use `route.ts` for API handlers.
- Use `index.ts` for module entry points only when the folder is intentionally a namespace.

## Change discipline

- Extract shared helpers before adding a second copy of the same logic.
- Keep route handlers thin.
- Keep DB schema and seed data in one place.
- Prefer additive refactors over behavior changes when the user only asked for cleanup.
