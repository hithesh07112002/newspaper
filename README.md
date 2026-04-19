# SmartLedger Pro

Production-oriented SmartLedger app built with Next.js, PostgreSQL, Prisma, DB-backed secure cookie sessions, role-based access control, and real-time dashboard refresh.

## Features

- Secure registration/login with hashed passwords and DB-backed opaque cookie sessions
- Role-based access control for User, Delivery Boy, Agent, and Admin
- Delivery Boy approval workflow managed by Agent
- PostgreSQL persistence with Prisma models and seed script
- Customer management (add, activate, stop)
- Delivery creation and confirmation
- Collection tracking with pending dues and mark-paid workflow
- Monthly business calculations (collection, incentive, loss, net)
- AI insights endpoint with Gemini fallback to rule-based tips
- Real-time dashboard updates through server-sent events

## Tech Stack

- Next.js App Router
- TypeScript
- Prisma + PostgreSQL
- bcryptjs + opaque session tokens
- Zod validation

## Environment Setup

1. Copy environment template:

```bash
cp .env.example .env.local
```

2. Configure values in `.env.local`:

```env
DATABASE_URL="postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=5&pool_timeout=30&sslmode=require"
DIRECT_URL="postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres?sslmode=require"
SESSION_TTL_SECONDS="604800"
GEMINI_API_KEY="optional"
NEXT_PUBLIC_SUPABASE_URL="https://PROJECT_REF.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_xxxxxxxxxxxxxxxxxxxx"
NEXT_PUBLIC_API_BASE_URL=""
```

## Supabase Setup

1. Create a new project in Supabase.
2. Open Project Settings -> Database -> Connection string.
3. Copy the pooled connection string and use it as DATABASE_URL.
4. Copy the direct connection string and use it as DIRECT_URL.
5. URL-encode your password if it contains special characters.
6. Run schema sync and baseline initialization:

```bash
npm run db:push
npm run db:seed
```

7. If frontend and API are served from different origins, set `NEXT_PUBLIC_API_BASE_URL` to your published app URL (for example `https://your-app.vercel.app`).
	If frontend and API are served from the same Next.js deployment, leave `NEXT_PUBLIC_API_BASE_URL` empty.

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Push Prisma schema:

```bash
npm run db:push
```

3. Initialize baseline app settings (no demo users/data):

```bash
npm run db:seed
```

4. Start app:

```bash
npm run dev
```

Open your deployed app URL (or the local dev URL shown by `npm run dev`).

## Credentials

- No default demo credentials are seeded.
- Register User and Agent accounts from the app UI.
- Register Delivery Boy accounts from the app UI (agent approval required before login).
- Create Admin accounts from your trusted admin process.

## Auth Workflow

- User or Agent registers with email + password and can log in immediately.
- Delivery Boy registers with email + password and remains in pending state.
- Agent/Admin sign in with real accounts stored in your database.
- Only approved delivery-boy accounts can log in.

## Useful Scripts

- `npm run dev` starts development server
- `npm run build` checks production build
- `npm run lint` runs ESLint
- `npm run db:push` updates DB schema
- `npm run db:seed` initializes baseline app settings only
- `npm run db:studio` opens Prisma Studio

## Production Notes

- Provision production users through your secure onboarding process
- Use managed PostgreSQL and secure secret management
- Set an appropriate session TTL per environment
- Add rate limiting and external monitoring for full production hardening

## Deploy to Vercel

1. Push this repository to GitHub.
2. In Vercel, import the GitHub repository.
3. In Project Settings -> Environment Variables, add:
	- DATABASE_URL
	- DIRECT_URL
	- NEXT_PUBLIC_SUPABASE_URL
	- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
	- NEXT_PUBLIC_API_BASE_URL (optional; leave empty for same-origin deploys)
	- SESSION_TTL_SECONDS (optional)
	- GEMINI_API_KEY (optional)
4. In Project Settings -> Build & Development Settings:
	- Build Command: npm run vercel-build
5. Deploy.

After first deploy, your database schema is pushed during build by the `vercel-build` script.
Run `npm run db:seed` once in production only to initialize baseline app settings.

## One-URL Deployment Checklist

- Deploy the same repository as a single Next.js app (frontend + API together).
- Keep `NEXT_PUBLIC_API_BASE_URL` empty unless API is hosted on a different domain.
- Verify these routes on your published URL:
	- `/api/auth/me` returns 401 when logged out and 200 after login.
	- `/api/dashboard?month=YYYY-MM` returns JSON (not HTML).
	- `/api/users` returns JSON for AGENT/ADMIN sessions.
