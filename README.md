# LeisureWorld Portal

A lightweight Next.js dashboard for LeisureWorld Cork operations. It provides a manager-facing portal for:

- pool chemistry monitoring
- daily task completion
- site scores
- incident logs
- duty handovers
- admin user/settings views

## Tech stack

- **Next.js 16** App Router
- **React 19**
- **TypeScript**
- **Tailwind CSS v4**
- **SQLite** for local portal state
- **Trail API** for operational data
- **Notion API** for incident logging
- **bcryptjs + JWT cookies** for auth

## Quick start

```bash
npm install
npm run dev
```

Then open:

- `http://localhost:3000/login`

## Production-style local run

This repo uses a standalone runtime bootstrap for `npm run start`.

```bash
npm run build
npm run start
```

## Environment variables

Create `.env.local` with the values the portal needs:

- `TRAIL_API_KEY`
- `NOTION_API_KEY`
- `JWT_SECRET` — optional, but recommended
- `ADMIN_PASSWORD` — optional, overrides the default seeded admin password
- `COOKIE_SECURE` — optional, force secure/insecure cookies for proxy or tunnel testing

## Default auth behavior

The database seed creates a local admin account if one does not exist.

- Email: `admin@leisureworld.ie`
- Name: `Fernando Serina`
- Password: `ADMIN_PASSWORD` if set, otherwise a dev fallback in the seed

## Project layout

See `docs/file-map.md` for the full route/module map.

## Useful commands

```bash
npm run lint
npm run build
npm run start
```

## Troubleshooting

### Login redirects back to /login

- Check the `lw_session` cookie is being set.
- Make sure the login email matches the seeded admin user.
- If running behind a tunnel, confirm the forwarded host/proto headers are preserved.

### Trail API returns 500

- Confirm `TRAIL_API_KEY` is available at runtime.
- Check the route logs and `src/lib/trail/client.ts` error messages.

### Standalone start fails

- `npm run start` should use `scripts/start-standalone.js`.
- That script loads `.env.local` and syncs `.next/static` into the standalone tree when needed.

### Database state is odd

- Remove `data/app.db` to reset the local SQLite store.
- Re-run the app so the seed schema recreates the database.
