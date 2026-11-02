# CardPop

Australian trading card marketplace — buy, sell, trade, and track the value of your collection.

**Live site**: [cardpop.com.au](https://cardpop.com.au)

## Stack

- **Frontend**: React 18 SPA, Vite, React Router v7, shadcn/ui, Tailwind CSS
- **Backend**: Express.js, one Node process (`server/index.js`) that also serves the built SPA
- **Database & Auth**: Supabase (PostgreSQL + RLS + Supabase Auth)
- **Deployment**: Vultr VPS — one Node process under systemd behind Cloudflare; deployed on push to `main`
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

Push to `main` — `.github/workflows/deploy.yml` SSHes to the VPS and runs `deploy/deploy.sh`, which builds the commit into a new release directory on the box and restarts the service on it.

Requires four repository secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS`.

All application secrets (Supabase service role key, Stripe, eBay, Kit.com, etc.) live in `/opt/cardpop/shared/.env` on the VPS — see `CLAUDE.md` → Deployment for the list and `docs/vultr-rollout.md` for the runbook.
