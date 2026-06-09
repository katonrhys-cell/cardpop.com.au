# CardPop

Australian trading card marketplace — buy, sell, trade, and track the value of your collection.

**Live site**: [cardpop.online](https://cardpop.online)

## Stack

- **Frontend**: React 18 SPA, Vite, React Router v7, shadcn/ui, Tailwind CSS
- **Backend**: Express.js served as a Vercel Serverless Function
- **Database & Auth**: Supabase (PostgreSQL + RLS + Supabase Auth)
- **Deployment**: Vercel (auto-deploy on push to `main` via GitHub Actions)
- **Payments**: Stripe
- **Market data**: eBay AU API
- **Email marketing**: Kit.com

## Getting Started

```bash
npm install
cp .env.example .env   # fill in the required secrets
npm run dev            # frontend on :3000, backend on :3001
```

See `.env.example` for all required environment variables and where to get them.

## Commands

```bash
npm run dev          # Start frontend dev server (port 3000)
npm run lint         # ESLint — errors only
npm run build        # Vite production build → dist/
npm test             # Run all tests (frontend + backend)
npm run test:watch   # Tests in watch mode
npm run test:coverage # Coverage report
```

## Project Structure

```
/
├── api/              # Vercel serverless entry (api/index.js exports Express app)
├── components/       # Shared React components
├── contexts/         # React context providers (Auth, Admin, Cart, Categories)
├── hooks/            # Custom hooks
├── lib/              # Frontend clients (supabase, apiServer)
├── pages/            # All page components (lazy-loaded)
├── src/
│   ├── app.js        # Express app
│   ├── routes/       # Route handlers
│   ├── middleware/   # Auth, rate limiting, CSRF, etc.
│   └── utils/        # Shared utilities
├── tests/
│   ├── frontend/     # Vitest + Testing Library
│   └── backend/      # Vitest + supertest
├── vercel.json       # Vercel routing config
└── CLAUDE.md         # AI assistant instructions for this repo
```

## Deployment

Push to `main` — GitHub Actions runs `vercel --prod` automatically.

Requires three GitHub Actions secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.

All other secrets (Supabase service role key, Stripe, eBay, Kit.com, etc.) are set as Vercel environment variables — see `PRD.md` for the full list.
