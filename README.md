# CardPop - Australia's Trading Card Marketplace

CardPop is Australia's most trusted trading card marketplace for Pokémon, Magic: The Gathering, sports cards and more. Built with React, Express, and PocketBase.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Preview production build
npm run start
```

## 🏗️ Architecture

**Frontend:** React SPA with Vite
- React Router v7 for navigation
- shadcn/ui components (Radix UI primitives)
- Tailwind CSS with custom theming
- Supabase client for data access

**Backend:** Express.js
- RESTful API routes
- Supabase authentication
- External integrations (eBay, Stripe, AI)
- Rate limiting and security middleware

**Database:** Supabase
- PostgreSQL database
- Real-time subscriptions
- File storage for images
- Row Level Security (RLS) policies

## 📁 Project Structure

```
├── components/          # Reusable UI components
│   ├── ui/            # shadcn/ui components
│   └── [other]        # Custom components
├── pages/             # Route components
│   ├── marketplace/   # Marketplace features
│   ├── shop/          # Shop features
│   ├── vault/         # Vault/trading features
│   └── [other]        # Other pages
├── lib/               # Client libraries
│   ├── pocketbaseClient.js
│   └── apiServerClient.js
├── src/               # Backend code
│   ├── routes/        # Express routes
│   ├── middleware/    # Express middleware
│   └── utils/         # Backend utilities
├── utils/             # Shared utilities
│   ├── seoUtils.js    # SEO helpers
│   └── imageUtils.js  # Image optimization
└── public/            # Static assets
```

## 🔧 Development Commands

```bash
# Development
npm run dev              # Start frontend dev server on port 3000
npm run lint             # ESLint (errors only)
npm run lint:warn        # ESLint (errors + warnings)

# Testing
npm test                 # Run all tests once
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate coverage report

# Build & Deploy
npm run build            # Generate llms.txt then Vite build → dist/
npm run start            # Preview production build on port 3000
```

## 🎯 Key Features

- **Marketplace:** Buy, sell, and trade trading cards
- **Vault:** Personal collection management
- **Shop:** Official CardPop store with sealed products
- **Markets:** Price analytics and market data
- **Community:** Events, forums, and social features
- **Grading:** Card grading integration
- **AI-Powered:** Card scanning and intelligent recommendations

## 🔐 Authentication

CardPop uses PocketBase authentication with:
- Email/password login
- Multi-factor authentication (MFA)
- Session management
- Device management
- Password reset flows

## 📊 SEO Implementation

CardPop has enterprise-level SEO:
- Dynamic sitemap generation
- Comprehensive structured data (Product, LocalBusiness, BlogPosting, etc.)
- Image optimization pipeline
- Core Web Vitals optimization
- International SEO with hreflang tags

See `CARDPOP_IMPROVEMENT_ROADMAP.md` for ongoing improvements.

## 🌐 Deployment

- **Frontend:** Deployed on Vercel
- **Backend:** Express server on port 3001
- **Database:** Supabase (PostgreSQL)
- **Monitoring:** Datadog synthetic tests

## 📚 Documentation

- `CLAUDE.md` - Detailed technical documentation for developers
- `CARDPOP_IMPROVEMENT_ROADMAP.md` - Strategic improvement roadmap
- This file - Project overview and quick start

## 🤝 Contributing

CardPop is actively developed. See the improvement roadmap for planned features and areas where contributions are welcome.

## 📄 License

Private project - All rights reserved.
