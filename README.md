# CardPop

Australian trading card marketplace — buy, sell, trade, and track the value of your collection.

**Live site**: [cardpop.com.au](https://cardpop.com.au)

## Stack

- **Frontend**: React 18 SPA, Vite, React Router v7, shadcn/ui, Tailwind CSS
- **Backend**: Express.js (Vercel serverless functions in production; `server/index.js` runs the same code as one Node process on the parked VPS stack)
- **Database & Auth**: Supabase (PostgreSQL + RLS + Supabase Auth)
- **Deployment**: Vercel (Git integration on `main`) behind Cloudflare. A self-hosted Vultr VPS stack is built and parked — see Deployment below
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
├── api/              # Prerender, sitemap, feed and cron modules (former Vercel functions)
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
├── server/           # Self-hosted server: dist/ + API + functions, routing from vercel.json
├── deploy/           # VPS bootstrap, deploy script, systemd unit, firewall
├── vercel.json       # Routing manifest (redirects, bot rewrites, headers)
└── CLAUDE.md         # AI assistant instructions for this repo
```

## Deployment

**Today**: push to `main` and Vercel's Git integration builds and deploys it. Application secrets (Supabase service role key, Stripe, eBay, Kit.com, etc.) live in the Vercel dashboard — see `CLAUDE.md` → Deployment for the list.

**Parked, ready to switch on**: a self-hosted stack for a Vultr VPS (`server/`, `deploy/`). `.github/workflows/deploy.yml` SSHes to the box and runs `deploy/deploy.sh`, which builds the commit into a new release directory and restarts the systemd service — but only while the repository variable `VPS_DEPLOY_ENABLED` is `true`; until then it skips. Needs four repository secrets (`VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS`) and `/opt/cardpop/shared/.env` on the box. Runbook: `docs/vultr-rollout.md`.
