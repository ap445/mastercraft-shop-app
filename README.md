# Mastercraft Shop Management v0.3 — Render Ready

Mobile-first shop-floor application for labor tracking, material usage, employee assignments, and supervisor visibility.

## v0.3 architecture

- **Render Web Service** — hosts the Next.js application for iPhone and desktop users.
- **Render PostgreSQL** — stores employees, jobs, operations, assignments, time entries, and material transactions.
- **No Supabase dependency** — the app connects directly to PostgreSQL using Render's private `DATABASE_URL`.
- **Server-side data access only** — the browser never receives database credentials.
- **Signed HTTP-only sessions** — employee/supervisor sessions use `APP_SESSION_SECRET`.

## What works

- Employee code + PIN login
- Employee / supervisor / admin roles
- Employee assigned-work queue
- Start/stop persistent job timers
- One active timer per employee, enforced by PostgreSQL
- Complete-operation action
- Material issue/return against the active job
- Supervisor live-floor dashboard
- Supervisor open-operations board
- Employee assignment action
- Automatic supervisor refresh
- Responsive iPhone and desktop interfaces
- `/api/health` endpoint checks application + database connectivity

## Easiest Render deployment: Blueprint

1. Put this folder in a GitHub repository.
2. In Render, choose **New > Blueprint** and connect the repository.
3. Render reads `render.yaml` and proposes:
   - `mastercraft-shop` web service
   - `mastercraft-shop-db` PostgreSQL database
4. Create the Blueprint.
5. The web service receives the database's internal connection string automatically as `DATABASE_URL`.
6. On startup, `npm run db:init` safely creates any missing tables/indexes.
7. When deployment completes, open the service's `https://...onrender.com` URL.
8. Visit `/api/health`. A healthy installation returns `{"ok":true,"database":"connected"}`.

The app uses Render's internal PostgreSQL connection when both resources are in the same Render account/region. This is the preferred database path.

## Load the development sample data

The production app starts with an empty database. To load the included sample employees/jobs, open the Render web service **Shell** and run:

```bash
npm run db:seed
```

Then the development logins are:

- Employee: `E1001` / PIN `1234`
- Supervisor: `S1001` / PIN `2468`

**Do not keep these credentials for production.** Replace the sample employees/PINs before shop-floor use.

## Manual Render setup (if you do not use Blueprint)

### 1. Create PostgreSQL

Create a Render PostgreSQL database named `mastercraft-shop-db`.

### 2. Create Web Service

Connect the GitHub repository and use:

- Runtime: **Node**
- Build command: `npm install && npm run build`
- Start command: `npm run db:init && npm start`
- Health check path: `/api/health`

### 3. Environment variables

Add:

- `DATABASE_URL` — use the Render PostgreSQL **internal database URL**
- `APP_SESSION_SECRET` — a long random secret, minimum 32 characters
- `DATABASE_SSL` — leave blank for the Render internal connection

### 4. Deploy

After deployment, test `/api/health`, then optionally run `npm run db:seed` from the Render Shell.

## Local development

1. Install Node.js 20+ and PostgreSQL.
2. Copy `.env.example` to `.env.local` and set `DATABASE_URL` and `APP_SESSION_SECRET`.
3. Run `npm install`.
4. Run `npm run db:init`.
5. Optionally run `npm run db:seed`.
6. Run `npm run dev`.
7. Open `http://localhost:3000`.

## Current routes

- `/login` — employee/supervisor sign-in
- `/employee` — iPhone-oriented employee workflow
- `/supervisor` — live floor + open operations + assignments
- `/api/health` — deployment/database health check

## Before real shop-floor deployment

1. Replace demo employees/PINs with real Mastercraft employee records.
2. Add an admin screen for employee/job/material setup so SQL is not needed for daily administration.
3. Add supervisor time corrections plus an audit trail.
4. Add QR/barcode scanning for jobs and materials.
5. Add job and operation creation/scheduling screens.
6. Add ADP reconciliation import.
7. Add Google Sheets job-cost/reporting export.
8. Add QuickBooks integration after shop-floor data is stable.

## Security note

The database URL and session secret belong only in Render environment variables. Never commit real production secrets into GitHub or `.env.example`.
