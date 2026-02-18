# SmartLedger Lite

Minimal college-project prototype of SmartLedger AI using Next.js.

## Features Included

- Simple role login (Agent / Delivery Boy)
- Seeded demo data in localStorage
- Customer management (add/list)
- Delivery confirmation
- Collection tracking
- Profit, incentive, salary, and loss calculations
- Monthly summary cards + AI insight button

## Demo Credentials

- Agent: `agent1` / `agent123`
- Delivery Boy: `boy1` / `boy123`

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Gemini Setup (Optional)

1. Copy `.env.example` to `.env.local`
2. Add your key:

```env
GEMINI_API_KEY=your_key_here
```

If no key is provided, the app shows a fallback insight message.

## Build Check

```bash
npm run build
```

## Notes

- This is a prototype focused on demonstration, not production security.
- Data is localStorage-based for fast setup and easy demo.
- SQLite upgrade can be added later (phase 2) without major UI changes.
