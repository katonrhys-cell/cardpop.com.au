# AI usage ledger and monthly allowances

Every Claude call the backend makes is recorded, and the member-facing AI
features have a monthly allowance. Added in the November 2026 cost review
(efficiency PR F), because card scans and grade estimates had a per-minute
rate limit but no monthly cap, and nothing measured what the AI features
actually cost.

## What is recorded

`public.ai_usage_events` — one row per call, written by the API with the
service-role key (`src/utils/aiUsage.js` → `recordAiUsage()`):

| Column | Meaning |
|---|---|
| `feature` | `card_scan`, `card_scan_escalation`, `grade_estimate`, `card_description`, `blog_draft`, `event_discovery`, `event_extraction`, `supplier_price` |
| `model` | The model that served the call (`message.model`, so a server-side fallback is priced correctly) |
| `user_id` | The member, for the three member-facing features; null for cron and admin work |
| `input_tokens` / `output_tokens` / `cache_read_tokens` / `cache_write_tokens` / `web_search_requests` | From the response's `usage` |
| `batch` | True for Message Batches requests (half price) |
| `cost_usd` | Computed when the row is written, from `MODEL_PRICES_USD_PER_MTOK` in `src/utils/aiUsage.js` |

The cost is computed from the published first-party prices at write time, so
old rows keep the price they were charged at. **When Anthropic changes a price,
update `MODEL_PRICES_USD_PER_MTOK`.** A model missing from the table is costed
at the most expensive listed rate, so it shows up high rather than free.

Each call is recorded right after it returns, before its reply is checked: a
refused, truncated or unparseable reply is billed all the same. A failed write
is logged and never fails the member's request. The streamed grade estimate
reads its usage from the stream's `message_start` / `message_delta` events.

Rows older than 18 months are pruned by the daily `private.run_housekeeping()`
job (pg_cron, 03:43 AEST).

## Where it shows

**Admin → Finance & Tax → AI spend** (`components/admin/AiSpendCard.jsx`,
`GET /admin/ai-usage?from=&to=`): calls, members, tokens and cost per feature
and model for the selected period, in AUD at the cached daily USD→AUD rate,
and as a share of what the platform earned in the same period (marketplace fee
revenue + shop gross profit, ex GST). The totals come from the security-definer
`ai_usage_summary(from, to)` function, which only the service role may call.

## Monthly allowances

`src/middleware/aiAllowance.js` → `requireAiAllowance(feature)` sits after the
route's auth check and before any upload is parsed, so a refused request costs
nothing. It counts the member's rows for that feature since midnight on the 1st
(Australia/Sydney) and answers **429** with `code: 'ai_allowance_exhausted'`
once the allowance is used.

| Feature | Route | Setting | Default |
|---|---|---|---|
| Card scans | `POST /card-ocr/scan` | `ai_monthly_limit_card_scan` | 300 |
| Grade estimates | `POST /grade-estimator/estimate` (and the 300 s function) | `ai_monthly_limit_grade_estimate` | 30 |
| AI listing descriptions | `POST /card-description/generate` | `ai_monthly_limit_card_description` | 300 |

- Change an allowance by setting the `platform_settings` key; `0` means unlimited.
- A scan's escalation to the stronger model is recorded as
  `card_scan_escalation`, so it doesn't use up an extra scan.
- Admins are exempt.
- The check **fails open**: if the ledger or the setting can't be read, the
  request goes ahead. A ledger outage must not switch the features off.

## Test

- `tests/backend/aiUsage.test.js`: cost maths, the Sydney month boundary, the
  allowance check and the middleware.
- `tests/backend/adminAiUsage.test.js`: the Finance endpoint.
- `tests/frontend/aiSpendCard.test.jsx`: the Finance card.
- `tests/db/run-ai-usage-ledger-migration.sh`: the migration against a throwaway
  Postgres (summary, pruning, role access).
