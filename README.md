# SmartLedger Pro

Production-oriented SmartLedger app built with Next.js, PostgreSQL, Prisma, secure cookie sessions, role-based access control, and real-time dashboard refresh.

## Features

- Secure registration/login with hashed passwords and JWT cookie sessions
- Role-based access control for User, Delivery Boy, Agent, and Admin
- Delivery Boy approval workflow managed by Agent
- Fixed hardcoded Agent credentials for controlled access
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
- bcryptjs + jose
- Zod validation

## Environment Setup

1. Copy environment template:

```bash
cp .env.example .env.local
```

2. Configure values in `.env.local`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/smartledger?schema=public"
JWT_SECRET="your-long-random-secret"
GEMINI_API_KEY="optional"
```

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Push Prisma schema:

```bash
npm run db:push
```

3. Seed demo data:

```bash
npm run db:seed
```

4. Start app:

```bash
npm run dev
```

Open http://localhost:3000

## Demo Credentials

- Fixed Agent Login: AGENT001 / AGENT@123
- Registered User seed: user1@example.com / user123
- Approved Delivery Boy seed: boy1@example.com / boy123
- Admin (legacy): admin@example.com / admin123

## Auth Workflow

- User registers with email + password and can log in immediately.
- Delivery Boy registers with email + password and remains in pending state.
- Agent signs in with fixed ID/password and reviews delivery-boy registrations.
- Only approved delivery-boy accounts can log in.

## Useful Scripts

- `npm run dev` starts development server
- `npm run build` checks production build
- `npm run lint` runs ESLint
- `npm run db:push` updates DB schema
- `npm run db:seed` seeds demo records
- `npm run db:studio` opens Prisma Studio

## Production Notes

- Replace demo credentials after first deployment
- Use managed PostgreSQL and secure secret management
- Keep JWT_SECRET long and unique per environment
- Add rate limiting and external monitoring for full production hardening

## Deploy to Vercel

1. Push this repository to GitHub.
2. In Vercel, import the GitHub repository.
3. In Project Settings -> Environment Variables, add:
	- DATABASE_URL
	- JWT_SECRET
	- GEMINI_API_KEY (optional)
4. In Project Settings -> Build & Development Settings:
	- Build Command: npm run vercel-build
5. Deploy.

After first deploy, your database schema is pushed during build by the `vercel-build` script.
If you want demo data in production, run `npm run db:seed` once against the production DATABASE_URL from a trusted machine.
