# LeisureWorld Manager Portal — Implementation Plan

> **Stack:** Next.js 15 (App Router) · TypeScript · SQLite (better-sqlite3) · Tailwind CSS v4 · shadcn/ui · Trail API · JWT Auth · Docker

**Goal:** A portable, self-contained manager portal for LeisureWorld Cork that surfaces live Trail data (pool chemistry, task completion, site scores, incident logs, handovers) with role-based access, deployable anywhere via Docker.

**Portability principle:** Zero external cloud dependencies at runtime. All state lives in SQLite on the host. Trail API is the only external call. Move the app = move a single directory or Docker volume.

**Architecture:**
- Next.js App Router — pages + API routes in one process
- SQLite via `better-sqlite3` — embedded, WAL mode, lives in `data/app.db`
- Trail API proxy layer — polled every 5 min, results cached in SQLite
- JWT session cookies — httpOnly, 7-day expiry
- Docker + docker-compose — single `docker compose up` to run anywhere

**Roles:**
| Role | Access |
|---|---|
| `admin` | Everything: user management, all sites, all modules, system settings |
| `operations_manager` | All sites, all modules, no user management |
| `manager` | Assigned sites only, operational modules (no admin) |

**Modules (Phase 1):**
1. Auth — login / session / role guard
2. App Shell — sidebar, nav, dark theme, responsive
3. Pool Chemistry — live chlorine/pH/temp per pool per site
4. Task Board — today's tasks, status, exceptions across sites
5. Site Scores — daily compliance scores, trends
6. Incident Log — viewer for Trail incident report tasks
7. Handovers — duty manager handover log

---

## Phase 1 — Foundation

### Task 1: Project scaffold

**Files:**
- Create: `lw-portal/` (root)
- Create: `package.json`, `tsconfig.json`, `next.config.ts`
- Create: `src/` App Router structure

```bash
cd /root
npx create-next-app@latest lw-portal \
  --typescript --tailwind --eslint --app --src-dir \
  --import-alias "@/*" --use-npm
cd lw-portal
npm install better-sqlite3 bcryptjs jose lucide-react
npm install -D @types/better-sqlite3 @types/bcryptjs
npm install @tailwindcss/vite
npx shadcn@latest init -d
npx shadcn@latest add button card input label badge separator scroll-area avatar dropdown-menu sidebar tooltip skeleton tabs table dialog alert
```

**Verify:** `npm run dev` starts without errors on port 3000.

---

### Task 2: Database schema

**File:** `src/lib/db/schema.sql` + `src/lib/db/index.ts`

Tables:
- `users` — id, email, name, password_hash, role, site_ids (JSON array), created_at
- `sites` — id (Trail site_id), name, status, active
- `trail_cache` — key, data (JSON), fetched_at (Trail API cache)
- `trail_poll_log` — id, polled_at, endpoint, status, record_count

Auth roles: `admin` | `operations_manager` | `manager`

Site access: admins + ops managers see all; managers see only their assigned `site_ids`.

---

### Task 3: Trail API service layer

**File:** `src/lib/trail/client.ts`

Centralised Trail API wrapper with:
- `fetchSites()` — GET /sites/v1/list
- `fetchTags()` — GET /tags/v1/list  
- `fetchTemplates()` — GET /task_templates/v1/list
- `fetchTaskInstances(startDate, endDate, templateIds)` — POST /task_reports/v1/task_instances (paginated)
- `fetchRecordLogs(taskInstanceIds[])` — POST /task_reports/v1/record_logs (batched ≤1000)
- `fetchChecklists(taskInstanceIds[])` — POST /task_reports/v1/checklists
- `fetchScores(startDate, endDate, dateInterval, siteIds?)` — POST /scores/v1/scores

All calls inject `API_KEY` from `process.env.TRAIL_API_KEY`. Rate limit: ≤60 req/min.

**File:** `src/lib/trail/poller.ts`

Background poller (called from API route on a schedule):
- Polls every 5 minutes for today's task instances
- Stores results in `trail_cache` table
- Template IDs for chemistry: `247590, 269953, 269952, 502146`
- Template IDs for incidents: `566160, 674497` (BT/DG Incident Reports)
- Template IDs for handovers: `656562, 653723` (CF/BT Duty Manager Handover)

---

### Task 4: Auth system

**Files:** `src/lib/auth.ts`, `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`, `src/middleware.ts`

- `login` — compare bcrypt hash, set JWT cookie
- `logout` — clear cookie, redirect to /login
- `getSession()` — read + verify JWT from cookie
- `requireAuth(role?)` — server component guard, redirects to /login
- Middleware protects all `/dashboard/*` routes

Seed admin on first boot:
- Email: `admin@leisureworld.ie`
- Password: from `ADMIN_PASSWORD` env var (required)

---

### Task 5: App shell (layout + sidebar)

**Files:** `src/app/dashboard/layout.tsx`, `src/components/shell/Sidebar.tsx`, `src/components/shell/TopBar.tsx`

Dark theme: `bg-zinc-950` base, `bg-zinc-900` sidebar, `border-zinc-800` borders, accent `emerald-500`.

Sidebar navigation (role-aware):
```
🏠 Overview          (all roles)
🧪 Pool Chemistry    (all roles)
✅ Task Board        (all roles)
📊 Site Scores       (all roles)
🚨 Incidents         (all roles)
📋 Handovers         (all roles)
─────────────────
⚙️  Admin            (admin only)
  └ User Management
  └ System Settings
```

Site selector in topbar — all sites for admin/ops manager, assigned only for manager.

---

### Task 6: Overview / home dashboard

**File:** `src/app/dashboard/page.tsx`

4 stat cards across the top:
- Today's task completion % across all accessible sites
- Open exceptions count
- Pool chemistry alerts (out-of-range readings today)
- Site scores (latest average)

Below: last 3 incidents + last 3 handovers as a quick-glance feed.

---

## Phase 2 — Modules

### Task 7: Pool Chemistry dashboard

**File:** `src/app/dashboard/chemistry/page.tsx`

Per-pool cards for each site (BT: 25m, 18m, Learners; CF: 25m, Learners; DG: 25m):
- Latest reading: Free Cl, Total Cl, Combined Cl, pH, Water Temp
- Status indicator: 🟢 normal / 🟡 watch / 🔴 exception
- Mini sparkline chart (7-day trend)
- Last read timestamp + who submitted

Thresholds:
| Metric | Low warning | OK range | High warning |
|---|---|---|---|
| Free Chlorine | < 0.5 | 0.5–3.0 | > 3.0 |
| Combined Chlorine | — | 0–1.0 | > 1.0 |
| pH | < 7.2 | 7.2–7.8 | > 7.8 |

Full history tab: date-range picker → line chart (same as what we already built).

---

### Task 8: Task Board

**File:** `src/app/dashboard/tasks/page.tsx`

Today's task instances fetched live from Trail API.
Grouped by site → by tag/department.

Each task row shows:
- Task name
- Status badge: `completed` 🟢 / `completedLate` 🟡 / `missed` 🔴 / `pending` ⏳ / `inProgress` 🔵
- Due window (from → by)
- Completed by (user name)
- Exception count (if any)

Filters: site selector, tag/department filter, status filter.
Auto-refreshes every 5 minutes.

---

### Task 9: Site Scores

**File:** `src/app/dashboard/scores/page.tsx`

Line chart: daily scores per site over selectable date range.
Default view: last 30 days, all accessible sites.

Table below chart: date × site grid with colour-coded scores (green ≥80, amber 60–79, red <60).

---

### Task 10: Incident Log

**File:** `src/app/dashboard/incidents/page.tsx`

Pulls all completed incident report task instances from Trail (templates: BT Incident Report `566160`, DG Incident Report `674497`).
Fetches record logs for each to display form data.

Table columns: Date | Site | Incident type | Reported by | Exceptions | Status
Click row → detail slide-over with full record log fields.

Filter: site, date range, exception status.

---

### Task 11: Duty Manager Handovers

**File:** `src/app/dashboard/handovers/page.tsx`

Pulls completed handover tasks (templates: BT `653723`, CF `656562`).
Fetches record logs.

Timeline view — most recent first.
Each card shows: site, date/time, submitted by, key notes from record log fields.
Click → full detail view.

---

## Phase 3 — Admin & Portability

### Task 12: Admin — User Management

**File:** `src/app/dashboard/admin/users/page.tsx` + API routes

- List all users (table: name, email, role, sites, last login)
- Create user (modal form)
- Edit user (role, site assignments, reset password)
- Deactivate user

---

### Task 13: Admin — System Settings

**File:** `src/app/dashboard/admin/settings/page.tsx`

- Trail API key (show last 4 chars, change)
- Site configuration (which pools exist per site)
- Chemistry thresholds (editable, stored in SQLite)
- Poll interval setting

---

### Task 14: Docker packaging

**Files:** `Dockerfile`, `docker-compose.yml`, `.env.example`, `README.md`

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build
VOLUME /app/data
EXPOSE 3000
CMD ["node", "server.js"]
```

```yaml
# docker-compose.yml
services:
  portal:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    env_file: .env
    restart: unless-stopped
```

`.env.example`:
```
TRAIL_API_KEY=your_trail_api_key_here
ADMIN_PASSWORD=change_me_on_first_run
JWT_SECRET=generate_a_random_64_char_string
NODE_ENV=production
```

**To move the app to a new server:**
1. `git clone` (or copy the directory)
2. Copy `.env` and `data/app.db`
3. `docker compose up -d`

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `TRAIL_API_KEY` | ✅ | Trail API key |
| `JWT_SECRET` | ✅ | Random 64-char string for JWT signing |
| `ADMIN_PASSWORD` | ✅ | Initial admin password (seeded on first boot) |
| `NODE_ENV` | ✅ | `development` or `production` |
| `PORT` | optional | Default 3000 |

---

## Key Trail Template IDs (LeisureWorld)

| Template | ID | Type |
|---|---|---|
| Test 25M Pool Water | 247590 | repeat |
| Test 18M Pool Water | 269953 | repeat |
| Test Learners Pool Water | 269952 | repeat |
| Chlorine & CO2 Levels | 502146 | repeat |
| Test 25M Pool Water Alkalinity | 396739 | repeat |
| Test 18M Pool Water Alkalinity | 396742 | repeat |
| Test Learner Pool Water Alkalinity | 396745 | repeat |
| 🚨 Pool Alarm Test | 440598 | repeat |
| BT Incident Report | 566160 | adHoc |
| DG Incident Report | 674497 | adHoc |
| BT Duty Manager Handover | 653723 | adHoc |
| CF Duty Manager Handover | 656562 | adHoc |
| Daily Ops Log | 348734 | repeat |

## Site IDs
| Site | ID |
|---|---|
| Bishopstown | 23201 |
| Churchfield | 26173 |
| Douglas | 32587 |
