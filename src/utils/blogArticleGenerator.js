import { OUTBOUND_TIMEOUT_MS } from './outboundTimeouts.js';
import supabase from './supabaseClient.js';
import logger from './logger.js';
import { buildPriceContext, quotableFigures } from './blogPriceContext.js';
import { checkDraft, BANNED_PHRASE_LIST } from './blogStyleGuard.js';

// Scheduled blog article generation.
//
// The daily cron takes the highest-priority queued topic whose price data is
// deep enough to support it, asks Claude for a draft grounded in that data,
// runs the draft through the style guard, and stores it in blog_articles.
//
// Drafts land unpublished by design: this writes outward-facing content under
// a named author byline, so a human approves before it goes live. Set
// BLOG_AUTOPUBLISH=true to publish on generation instead.

// Claude Opus 5.5: the current Opus, $4 / $20 per MTok against Claude Opus 5's
// $5 / $25, same context window and tokenizer. Thinking is always on and
// effort is the control (set explicitly below — the default dropped to
// medium); no forced tool_choice is used here, so nothing else changes.
const MODEL = 'claude-opus-5-5';
const MAX_ATTEMPTS = 2;
// How far down the queue a single run will look for a topic whose data gate is
// satisfied. Only ever produces one article — the window is for skipping past
// topics that aren't ready yet, not for generating several.
const CANDIDATE_WINDOW = 5;

let cachedClient = null;
// The SDK is imported here, on first use, rather than at module load: this
// file sits in the routes graph (routes/blog.js) and the SDK is dead weight on
// every cold start that isn't the nightly draft. The timeout caps the stream
// under the 300 s function so a stall fails inside the budget instead of as a
// 504; one retry, not the SDK's default two, for the same reason.
async function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set — blog generation is disabled.');
  }
  if (!cachedClient) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    cachedClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: OUTBOUND_TIMEOUT_MS.anthropicDraft,
      maxRetries: 1,
    });
  }
  return cachedClient;
}

// The article shape. Mirrors the columns on blog_articles that the public
// article page and its JSON-LD actually read.
const ARTICLE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Headline. Specific, not clickbait. No colon-subtitle formula unless it earns its place.' },
    excerpt: { type: 'string', description: 'One or two sentences summarising the finding, for the blog index card.' },
    content: { type: 'string', description: 'The article body as HTML. See the formatting rules.' },
    seo_title: { type: 'string', description: 'Max 60 characters, primary keyword first.' },
    seo_description: { type: 'string', description: 'Max 155 characters.' },
    read_time_minutes: { type: 'integer', description: 'Realistic reading time at 220 words per minute.' },
    tags: { type: 'array', items: { type: 'string' }, description: '4 to 8 lowercase tags.' },
    faqs: {
      type: 'array',
      description: '4 to 6 questions real Australian collectors would search, with direct answers.',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          answer: { type: 'string' },
        },
        required: ['question', 'answer'],
        additionalProperties: false,
      },
    },
  },
  required: [
    'title',
    'excerpt',
    'content',
    'seo_title',
    'seo_description',
    'read_time_minutes',
    'tags',
    'faqs',
  ],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You write for The Parallel Report, the blog of CardPop — an Australian trading card marketplace. Your readers are Australian collectors and sellers: Pokémon, NBA, AFL, NRL, One Piece.

VOICE
Write like an analyst who collects, not a content marketer. Plain, specific, occasionally blunt. Australian English, AUD, Australia Post, PSA/BGS/CGC. Ordinary words over impressive ones, always.

Three habits define this voice:

1. Anchor every claim to something checkable — the figure, the date, the window, the count. "The PSA 10 averaged AUD $412 across the three weeks to 25 July, over nine sales" beats "PSA 10s have been strong lately". A sentence you cannot anchor is a sentence to cut.
2. Say plainly when you do not know. "Four sales in the window is not enough to call a direction" is a better sentence than a confident guess dressed up as analysis. Naming the limit of the evidence is a feature of this voice, not a hedge to apologise for.
3. Put the evidence before the verdict. Walk through what the numbers show, then say what you think it means. Do not open with the conclusion and reverse-engineer support for it.

You are allowed to say a card is overpriced, that a grading submission is not worth the postage, or that the data will not support a call. Be hard on the market and on practices; never sneer at collectors who bought in. Criticise the decision, not the person.

HARD RULES — a draft breaking any of these is rejected and sent back:

1. Never use these words or phrases: ${BANNED_PHRASE_LIST.join(', ')}. Do not swap in synonyms; rewrite the sentence so it does not need one.
2. Never write "not just X, it's Y" or "not only… but also". State the point directly.
3. Do not open on a hook ("Whether you're a seasoned collector…", "In the world of…"). Open on a concrete fact, number, or date.
4. Em-dashes: at most one per paragraph, and no more than one per section overall. Prefer a full stop. Most sentences that want an em-dash read better as two sentences.
5. Vary sentence length deliberately. Include short sentences of eight words or fewer. Uniform sentence length is the clearest sign of machine-written copy.
6. No "In conclusion". No restating the question before answering it. No summary paragraph that repeats what the article just said.

EVIDENCE
You are given real price data from CardPop's daily eBay AU/US snapshots. Quote those AUD figures directly and name the date or window they come from.

The snapshot history is short. State the window explicitly whenever you describe movement: "across the three weeks to 25 July, the PSA 10 averaged AUD $X". Never imply a longer horizon than the data covers — no "this year", "over the past 12 months", "historically" — and never invent a figure that is not in the supplied data. If the data does not support a claim, say what it does support instead.

FORMATTING
Return the body as HTML fragments only: <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <table>, <a>. No <html>, <head>, <body>, <h1>, no markdown, no inline styles, no class attributes. The page renders the title separately, so the body starts at the first <h2>.

Link internally where it helps the reader: card price pages at the URLs given in the data, and https://cardpop.com.au/grading for grading topics. Use real anchor text, not "click here".`;

function buildUserPrompt(topic, priceContext, violations = []) {
  const parts = [];

  parts.push(`Write the article for this brief.

WORKING TITLE: ${topic.title_hint}
CATEGORY: ${topic.category}
BRIEF: ${topic.brief}`);

  if (topic.keywords?.length) {
    parts.push(`SEO KEYWORDS (primary first — the primary must appear in the title, the first 100 words, and at least one <h2>; the rest woven in only where they read naturally):
${topic.keywords.map((k) => `- ${k}`).join('\n')}`);
  }

  if (priceContext.cards.length > 0) {
    parts.push(`PRICE DATA — CardPop daily eBay snapshots, all figures AUD. These are the only figures you may quote.

Shared window across all cards below: ${priceContext.sharedWindow.from} to ${priceContext.sharedWindow.to} (${priceContext.sharedWindow.days} days).

${JSON.stringify(priceContext.cards, null, 2)}

Notes on reading this: "latest" is the most recent daily snapshot. "gradedPremiumMultiple" is how many times the raw average a graded copy fetches. "overWindow.rawChangePct" is the change from the first to the last observation in that card's own window — if it is null there was not enough data to state a direction, so do not state one.`);
  } else {
    parts.push(
      'PRICE DATA: none supplied for this topic. Do not quote specific card prices; write the explainer on its merits.',
    );
  }

  parts.push(`LENGTH: 1,400–2,200 words in the body.
FAQs: 4–6, answering what an Australian collector would actually type into Google. Answer in 2–4 sentences each, no preamble.`);

  if (violations.length > 0) {
    parts.push(`YOUR PREVIOUS DRAFT WAS REJECTED. Fix every point below and return the full article again. Do not acknowledge this message in the output.

${violations.map((v, i) => `${i + 1}. ${v}`).join('\n')}`);
  }

  return parts.join('\n\n');
}

async function requestDraft(topic, priceContext, violations) {
  const client = await anthropic();
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    // Blog copy will not trip the safety classifiers, but a refusal returns a
    // 200 with empty content rather than an error, so the fallback keeps the
    // cron from silently producing nothing.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    thinking: { type: 'adaptive' },
    output_config: {
      effort: 'high',
      format: { type: 'json_schema', schema: ARTICLE_SCHEMA },
    },
    // The ~13 KB house-style prompt is identical on every call; cache it so the
    // style-guard retry a few seconds later (and any other draft within the
    // five-minute window) reads it at a tenth of the price.
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: buildUserPrompt(topic, priceContext, violations) }],
  });

  const message = await stream.finalMessage();

  if (message.stop_reason === 'refusal') {
    throw new Error(`Model declined the request (${message.stop_details?.category || 'unknown'}).`);
  }
  if (message.stop_reason === 'max_tokens') {
    throw new Error('Draft hit the output token cap before finishing.');
  }

  const text = message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Model returned output that was not valid JSON.');
  }
}

/**
 * Generate a validated draft for a topic. Retries once with the style guard's
 * complaints fed back before giving up.
 */
export async function generateDraft(topic) {
  const priceContext = await buildPriceContext(topic.tracked_card_slugs || []);

  if ((topic.tracked_card_slugs || []).length > 0) {
    if (priceContext.cards.length === 0) {
      throw new Error(`No price snapshots for any of: ${topic.tracked_card_slugs.join(', ')}`);
    }
    if (priceContext.minDays < topic.min_snapshot_days) {
      const error = new Error(
        `Only ${priceContext.minDays} days of price history; topic needs ${topic.min_snapshot_days}.`,
      );
      error.code = 'INSUFFICIENT_DATA';
      throw error;
    }
  }

  const figures = quotableFigures(priceContext);
  let violations = [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const draft = await requestDraft(topic, priceContext, violations);
    violations = checkDraft(draft, { figures });

    if (violations.length === 0) {
      return { draft, priceContext, attempts: attempt };
    }
    logger.warn(
      `[BLOG_GEN] "${topic.slug}" attempt ${attempt} failed style checks: ${violations.join(' | ')}`,
    );
  }

  const error = new Error(`Draft failed style checks after ${MAX_ATTEMPTS} attempts: ${violations.join(' | ')}`);
  error.code = 'STYLE_REJECTED';
  throw error;
}

function clamp(value, max) {
  const str = String(value || '').trim();
  return str.length <= max ? str : `${str.slice(0, max - 1).trimEnd()}…`;
}

async function storeArticle(topic, draft) {
  const publish = process.env.BLOG_AUTOPUBLISH === 'true';

  const row = {
    title: draft.title,
    slug: topic.slug,
    excerpt: draft.excerpt,
    content: draft.content,
    category: topic.category,
    author: topic.author,
    tags: draft.tags || [],
    marketplace_keywords: topic.marketplace_keywords || [],
    faqs: draft.faqs || [],
    seo_title: clamp(draft.seo_title, 60),
    seo_description: clamp(draft.seo_description, 155),
    read_time_minutes: draft.read_time_minutes,
    is_published: publish,
    published_at: publish ? new Date().toISOString() : null,
    auto_generated: true,
    generation_model: MODEL,
  };

  const { data, error } = await supabase.from('blog_articles').insert(row).select('id, slug').single();
  if (error) throw new Error(`Failed to insert article: ${error.message}`);
  return { article: data, published: publish };
}

async function markTopic(topicId, patch) {
  const { error } = await supabase
    .from('blog_article_topics')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', topicId);
  if (error) logger.error(`[BLOG_GEN] Failed to update topic ${topicId}: ${error.message}`);
}

/**
 * Claim the next queued topic. The status flip to 'generating' is conditional
 * on the row still being 'queued', so two overlapping cron invocations can't
 * both take the same topic and publish it twice.
 */
async function claimNextTopic(skipIds = []) {
  const { data: candidates, error } = await supabase
    .from('blog_article_topics')
    .select('*')
    .eq('status', 'queued')
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(CANDIDATE_WINDOW);
  if (error) throw new Error(`Failed to load topic queue: ${error.message}`);

  for (const topic of candidates || []) {
    // Deferred earlier in this same run — it's back at 'queued', so it would
    // otherwise be re-claimed immediately and deferred again forever.
    if (skipIds.includes(topic.id)) continue;

    // Don't regenerate over an article that already exists at this slug.
    const { data: existing } = await supabase
      .from('blog_articles')
      .select('id')
      .eq('slug', topic.slug)
      .maybeSingle();
    if (existing) {
      await markTopic(topic.id, {
        status: 'skipped',
        last_error: 'An article already exists at this slug.',
        article_id: existing.id,
      });
      continue;
    }

    const { data: claimed, error: claimError } = await supabase
      .from('blog_article_topics')
      .update({
        status: 'generating',
        attempts: topic.attempts + 1,
        last_attempt_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', topic.id)
      .eq('status', 'queued')
      .select('*')
      .maybeSingle();

    if (claimError) throw new Error(`Failed to claim topic: ${claimError.message}`);
    if (claimed) return claimed;
  }

  return null;
}

/**
 * Cron entrypoint. Generates at most one article per run — the job runs daily
 * and a single well-checked article beats a batch nobody reviews.
 */
export async function runScheduledGeneration() {
  const deferred = [];

  // A topic whose price history isn't deep enough yet goes back in the queue
  // and the run moves on to the next candidate. Stopping at the first deferral
  // would let one blocked topic at the top of the queue stall generation every
  // night until its data caught up.
  for (let i = 0; i < CANDIDATE_WINDOW; i += 1) {
    const topic = await claimNextTopic(deferred.map((d) => d.id));
    if (!topic) break;

    try {
      const { draft, attempts } = await generateDraft(topic);
      const { article, published } = await storeArticle(topic, draft);

      await markTopic(topic.id, {
        status: 'generated',
        article_id: article.id,
        generated_at: new Date().toISOString(),
        last_error: null,
      });

      logger.info(
        `[BLOG_GEN] Generated "${article.slug}" for topic ${topic.slug} in ${attempts} attempt(s), published=${published}`,
      );
      return {
        generated: true,
        topic: topic.slug,
        slug: article.slug,
        articleId: article.id,
        published,
        attempts,
        deferred: deferred.map((d) => d.slug),
      };
    } catch (error) {
      // Waiting on price history is a "come back tomorrow"; anything else is a
      // real failure and the topic stays out of the queue until someone looks.
      const requeue = error.code === 'INSUFFICIENT_DATA';
      await markTopic(topic.id, {
        status: requeue ? 'queued' : 'failed',
        last_error: error.message,
      });
      logger.warn(`[BLOG_GEN] Topic "${topic.slug}" ${requeue ? 'deferred' : 'failed'}: ${error.message}`);

      if (!requeue) throw error;
      deferred.push({ id: topic.id, slug: topic.slug, reason: error.message });
    }
  }

  if (deferred.length > 0) {
    return {
      generated: false,
      reason: `No topic has enough price history yet (deferred: ${deferred.map((d) => d.slug).join(', ')}).`,
      deferred: deferred.map((d) => d.slug),
    };
  }

  return { generated: false, reason: 'No topic ready in the queue.' };
}
