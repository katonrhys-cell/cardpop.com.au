# Grading submission partners

The Australian stores and services that take a collector's cards and submit
them to **PSA, Beckett (BGS), CGC, ACE, SGC or TAG** on their behalf. They are
what every **"Grade with PSA"** (…BGS, CGC, ACE, SGC, TAG) button on the grade
estimator leads to: `/grading/submission-partners?company=psa` opens the
Submission Partners page on the list of partners that submit to that company,
with the company's own direct-submission note above it. The same list, with a
company picker, sits on Compare Companies (`/grading/companies`).

Admins maintain the list at **Admin → Grading Partners** (`/admin/grading-partners`)
without a deploy. The fourteen seeded rows are a starting list: the PSA and
Beckett partners that used to be hardcoded on Compare Companies, plus partners
for CGC, ACE, SGC and TAG researched on 2026-11-04 (sources in each row's admin
notes) — **check those four before relying on them**, the notes say what to confirm.

## Where things live

| Piece | File |
|---|---|
| Schema, RLS, seed | `supabase/migrations/20261104192816_grading_submission_partners.sql` |
| JS mirror of the seed (prerender + browser fallback) | `data/gradingPartnersSeed.js` — a test keeps its slugs/companies in step with the SQL |
| Per-company direct-submission note + link | `submit: { url, note }` on each entry of `data/gradingCompanies.js` |
| Pure helpers (path, filtering, cleaning, slug) | `utils/gradingPartners.js` — shared with `api/prerender.js` |
| Supabase read (falls back to the seed on error) | `lib/gradingPartners.js` |
| Company chips + partner cards | `components/grading/GradingPartnerList.jsx` |
| Public pages | `pages/grading/SubmissionPartnersPage.jsx` (`?company=` in the URL), `pages/grading/GradingCompaniesPage.jsx` |
| "Grade with …" buttons | `GraderCard` and the "Grading Services Covered" strip in `pages/grading/GradeEstimatorPage.jsx` → `gradingPartnersPath(key)` |
| Admin | `pages/admin/GradingPartnersAdminPage.jsx` (`/admin/grading-partners`) |
| Bot HTML | `GRADING_PARTNER_SECTIONS` in `api/prerender.js` (one section per company, from the seed) |
| Tests | `tests/frontend/gradingPartners.test.js`, `tests/frontend/gradingPartnerList.test.jsx`, `tests/db/run-grading-partners-migration.sh` |

## Data model

`grading_submission_partners` — one row per business.

| Column | Meaning |
|---|---|
| `slug` | Unique key, `^[a-z0-9]+(-[a-z0-9]+)*$` (DB check). Auto-derived from the name in the admin form. |
| `name`, `website`, `location`, `description` | What the card shows. `website` must start with `http(s)://` (DB check). |
| `companies` | `text[]` of lower-case company keys the partner submits to — `psa`, `bgs`, `cgc`, `ace`, `sgc`, `tag`. At least one (DB check); only those six (DB check — a new company means a migration that widens it, plus an entry in `GRADING_COMPANIES`). |
| `company_links` | `{"psa": "https://…", "bgs": "https://…"}` — the partner's page for that company. The public card links there for the selected company, else to `website`. Must be a JSON object (DB check); the helpers drop non-http values. |
| `categories` | Free-text chips: `TCG`, `Sports Cards`, `AFL`… |
| `notes` | Admin-only: where the listing came from, what to re-check. Never rendered publicly. |
| `sort_order`, `is_active` | Display order (lower first) and visibility. Inactive rows are hidden from everyone but admins. |

RLS: anyone reads active rows (admins see inactive too); insert / update /
delete are admin-only (`profiles.is_admin`). The admin page writes through the
browser client under those policies — there is no server route.

## Fallbacks

`fetchActiveGradingPartners()` returns the seed with `fromSeed: true` if the
table can't be read (the migration hasn't been applied yet, or the request
failed), so the pages never show an empty grid; the list then carries a small
"built-in list" note. The prerenderer always renders the seed — admin edits
reach the SPA only, so update the migration's seed (and the JS mirror) when a
long-term change should also be in the bot copy.

## Keeping it honest

- Every partner is a third party; CardPop isn't affiliated. The page says so and
  every outbound link is `rel="nofollow"`.
- Prices and turnarounds change: descriptions should describe the service, not
  promise a date or a fee. Put what to re-check in `notes`.
- The direct-submission notes on `data/gradingCompanies.js` summarise each
  company's own international policy at the time of writing (e.g. TAG only
  accepts Australian cards through PGCG; ACE accepts direct submissions from
  Australia with a 30-card minimum). Re-check them when a company changes policy.
