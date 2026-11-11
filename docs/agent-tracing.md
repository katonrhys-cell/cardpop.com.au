# Sentry agent tracing

Every Claude call the backend makes is traced into Sentry: the
**cardpop-australia-yr / javascript-react** project (Agents → Overview /
Conversations). You get model, token use (cache reads and writes counted),
latency, cost, stop reason and failures for each AI feature. Unless it is
switched off, Sentry also records the prompt and the reply.

This sits beside the in-house ledger (`ai_usage_events`, `docs/ai-usage.md`).
The ledger is the billing record and the allowance check. Sentry is for
debugging: why a scan misread a card, which step of a job was slow, what the
model was actually sent.

## What is traced

| Feature | Agent name in Sentry | Where | Conversation id |
|---|---|---|---|
| Card scan (fast read + escalation) | `Card identifier` | `src/utils/cardOcr.js` | — (member id only) |
| Grade estimate (streamed) | `Grade estimator` | `src/utils/gradeEstimator.js` | — (member id only) |
| Listing description | `Listing description writer` | `src/routes/card-description.js` | — (member id only) |
| Nightly blog draft (+ style-guard redraft) | `Blog drafter` | `src/utils/blogArticleGenerator.js` | `blog-topic-<topic id>` |
| Event scan: web-search discovery | `Event discovery` | `src/utils/eventScanner.js` | `event-scan-<run id>` |
| Event scan: page extraction | `Event extractor` | `src/utils/eventScanner.js` | `event-scan-<run id>`, or `event-watch-<event id>` for a watched event's weekly re-scan |
| Supplier price check | `Supplier price reader` | `src/utils/supplierPrice.js` | — |

Each feature run is one `gen_ai.invoke_agent` span, with a `gen_ai.chat` child
for each model request. A scan that escalates shows two chat spans, and so does
a blog draft that was sent back for a redraft.

**Conversations only use real application ids.** Sentry's guidance is to leave
the id out rather than make one up from a request id. The blog topic, the
event-scan run and the watched event are real ids, so those jobs appear in the
Conversations view. The member-facing features have no session id today, so
they appear under Agents → Overview and Traces, tagged with the member's id,
but not under Conversations. To group a seller's scan → description → listing
as one conversation, the listing form would need to send a draft id with both
calls.

## How it works

- **`src/instrument.js`** is the only place `Sentry.init` runs. `src/app.js`
  imports it first, and so do the three separate long-running functions that
  never load the Express app: `api/blog-generate.js`, `api/event-scan.js` and
  `api/grade-estimate.js`. Before this change those three never initialised
  Sentry at all.
- **`src/utils/aiTracing.js`** has the helpers: `traceAiAgent`, `traceChat` +
  `recordChatResponse`, `traceMessagesCreate` (for SDK `messages.create`),
  `withAiConversation` / `setAiConversationId`, and the `aiTracesSampler`.
- **The spans are manual.** Sentry's Anthropic auto-instrumentation is filtered
  out on purpose. Half the calls are direct HTTP requests, which it can't see.
  The blog drafter uses `beta.messages.stream`, which its wrapper doesn't cover.
  And the photo rule below has to be enforced in one place. Keeping it filtered
  out also stops every span being recorded twice.
- **Sampling.** Ordinary request tracing stays off (`SENTRY_TRACES_SAMPLE_RATE`,
  default 0; see `docs/performance.md`). `aiTracesSampler` keeps every
  `gen_ai.*` root span at `SENTRY_AI_TRACES_SAMPLE_RATE` (default 1). If the
  request span an AI call runs under isn't sampled, the agent span starts its
  own trace so it isn't dropped along with that span.
- **Serverless flush.** On Vercel, when a root agent span ends,
  `flushAfterResponse()` hands `Sentry.flush(2000)` to the platform's
  `waitUntil` (the request-context hook that `@vercel/functions` wraps). The
  flush then runs after the response, so a member never waits on Sentry's
  ingest, and the instance isn't frozen with the transaction still queued. The
  VPS process skips it because its transport sends on its own.
- **One root per event-scan model call.** An event-scan run is deliberately
  *not* one transaction. A run can extract dozens of pages, and nesting them
  all would push a single transaction past Sentry's size limit, which would
  drop the whole run. The run's calls share one conversation
  (`event-scan-<run id>`) instead, which groups them in the Conversations view.

## Privacy

- **Photos never leave.** Image and document blocks are recorded as
  `[photo not recorded]`, never as data (enforced in `toPart()`, covered by
  `tests/backend/aiTracing.test.js`).
- **The member is recorded by id only.** `beforeSendTransaction` strips any
  other user field, and the request body, cookies and headers.
- **Prompts and replies are recorded** so that a conversation can be replayed.
  Each text part is clipped at 8,000 characters. To keep only tokens, latency
  and cost, set `SENTRY_AI_RECORD_CONTENT=false`; that takes effect on the next
  deploy.
- Nothing is sent from the test suite (`enabled: !process.env.VITEST`).
- **No `dataCollection` in `Sentry.init`.** In SDK 10.x, passing any
  `dataCollection` object makes every field it leaves out default to full
  collection (user info, cookies, all headers, request and response bodies).
  That silently overrides `sendDefaultPii: false`. Content recording for these
  spans is decided in `aiTracing.js` instead. `tests/backend/instrument.test.js`
  checks this.

## Configuration

| Variable | Default | Effect |
|---|---|---|
| `SENTRY_DSN` | the javascript-react project's DSN (`DEFAULT_SENTRY_DSN` in `src/instrument.js`) | Where backend errors **and** agent traces go. If Vercel has an older value set, it wins; delete it or update it to send there. |
| `SENTRY_AI_TRACES_SAMPLE_RATE` | `1` | Share of AI feature runs traced (0–1). |
| `SENTRY_AI_RECORD_CONTENT` | on | `false` = no prompts or replies, metrics only. |
| `SENTRY_TRACES_SAMPLE_RATE` | `0` | Ordinary request tracing (unchanged). |

## Adding a new Claude call

Wrap it the same way, or the call is invisible here. Recording usage with
`recordAiUsage()` is still required as well (`docs/ai-usage.md`).

- SDK `messages.create`:
  `traceMessagesCreate('Agent name', params, (p) => client.beta.messages.create(p))`.
- A direct request or a stream: `traceAiAgent('Agent name', () => traceChat(request, async (span) => { …; recordChatResponse(span, message); }))`.
- If the work belongs to a real id, wrap it in
  `withAiConversation({ conversationId, userId }, …)`.
