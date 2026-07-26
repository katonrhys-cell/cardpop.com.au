// Style guard for generated blog drafts.
//
// The prompt asks for these things; this checks them. A model that has been
// told "vary your sentence length" complies about as often as it doesn't, so
// the rules that make copy read as machine-written are enforced mechanically
// and fed back on a retry rather than trusted.
//
// Every rule here targets a specific tell. Nothing is a matter of taste: the
// banned vocabulary is the vocabulary that shows up in LLM prose and almost
// nowhere in the site's hand-written articles.

// Words and constructions that read as generated. Matched case-insensitively
// on word boundaries so "delved" and "Delve" both trip.
const BANNED_PHRASES = [
  'delve',
  'dive into',
  'diving into',
  'landscape of',
  'the landscape',
  'testament to',
  'crucial',
  'robust',
  'seamless',
  'seamlessly',
  'unlock',
  'unlocking',
  'elevate',
  'elevating',
  'navigate the world of',
  "it's worth noting",
  'it is worth noting',
  'in the world of',
  "in today's fast-paced",
  'in conclusion',
  'when it comes to',
  'ever-evolving',
  'game-changer',
  'game changer',
  'look no further',
  'a myriad of',
  'plethora',
];

// "It's not just a card, it's an investment." Ubiquitous in generated copy,
// absent from the site's own articles.
const NOT_JUST_RE = /\b(is|it's|it is|isn't|are|aren't|was|wasn't)\s+not\s+just\b|\bnot\s+(only|merely|just)\b[^.!?]{0,80}\b(but|it's|it is)\b/i;

// Openers that stall before saying anything.
const FILLER_OPENERS = [
  /^\s*whether you(?:'re| are)\b/i,
  /^\s*in (?:the )?(?:world|realm) of\b/i,
  /^\s*if you(?:'re| are) (?:a |an )?(?:seasoned|new|budding)\b/i,
  /^\s*let(?:'s| us) (?:take a look|explore|dive)\b/i,
  /^\s*as (?:a |an )?(?:collector|investor|enthusiast),? you\b/i,
];

const BLOCK_RE = /<(p|li|h2|h3|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi;

export function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&(?:lt|gt|quot|#39);/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function textBlocks(html) {
  const blocks = [];
  for (const match of String(html || '').matchAll(BLOCK_RE)) {
    const text = stripHtml(match[2]);
    if (text) blocks.push({ tag: match[1].toLowerCase(), text, raw: match[2] });
  }
  return blocks;
}

function splitSentences(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function stdev(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Check a generated draft against the house style rules.
 *
 * @param {{ title: string, content: string, excerpt: string }} draft
 * @param {{ figures?: number[], minWords?: number, maxWords?: number }} options
 *   figures — AUD values from the price snapshots; at least one must appear in
 *   the copy, so a "data-backed" article can't be entirely invented.
 * @returns {string[]} violations, empty when the draft passes
 */
export function checkDraft(draft, options = {}) {
  const { figures = [], minWords = 900, maxWords = 3200 } = options;
  const violations = [];

  const html = draft?.content || '';
  const text = stripHtml(html);
  const lower = text.toLowerCase();
  const blocks = textBlocks(html);
  const words = text.split(/\s+/).filter(Boolean);

  if (words.length < minWords) {
    violations.push(`Article is ${words.length} words; minimum is ${minWords}.`);
  }
  if (words.length > maxWords) {
    violations.push(`Article is ${words.length} words; maximum is ${maxWords}.`);
  }

  // 1. Banned AI vocabulary.
  const found = BANNED_PHRASES.filter((phrase) => {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(lower);
  });
  if (found.length > 0) {
    violations.push(`Remove banned phrases (rewrite the sentence, don't swap synonyms): ${found.join(', ')}.`);
  }

  // 2. "not just X, but Y" and its variants.
  if (NOT_JUST_RE.test(text)) {
    violations.push(
      'Remove the "not just X, it\'s Y" / "not only… but" construction. State the point directly.',
    );
  }

  // 3. Filler openers, checked on the first paragraph and on every h2 section's
  //    opening sentence.
  const firstParagraph = blocks.find((b) => b.tag === 'p');
  if (firstParagraph && FILLER_OPENERS.some((re) => re.test(firstParagraph.text))) {
    violations.push(
      'The opening paragraph starts with a filler hook. Open on a concrete fact, number or date.',
    );
  }

  // 4. Em-dash density. One per block at most, and no more than one per
  //    section overall — the single loudest generated-prose tell.
  const totalEmDashes = (text.match(/—/g) || []).length;
  const sectionCount = Math.max(1, (html.match(/<h2\b/gi) || []).length);
  const emDashCap = Math.max(3, sectionCount);
  const crowdedBlock = blocks.find((b) => (b.text.match(/—/g) || []).length > 1);
  if (crowdedBlock) {
    violations.push(
      `A <${crowdedBlock.tag}> uses more than one em-dash. Split it into separate sentences: "${crowdedBlock.text.slice(0, 90)}…"`,
    );
  }
  if (totalEmDashes > emDashCap) {
    violations.push(
      `${totalEmDashes} em-dashes across ${sectionCount} section(s); cap is ${emDashCap}. Replace the rest with full stops.`,
    );
  }

  // 5. Sentence-length variance. Uniform ~20-word sentences are the second
  //    biggest tell after em-dashes.
  const sentenceLengths = splitSentences(text).map((s) => s.split(/\s+/).filter(Boolean).length);
  if (sentenceLengths.length >= 10) {
    const spread = stdev(sentenceLengths);
    const shortest = Math.min(...sentenceLengths);
    if (spread < 5) {
      violations.push(
        `Sentence lengths are too uniform (standard deviation ${spread.toFixed(1)}, need 5+). Break some sentences up and let others run long.`,
      );
    }
    if (shortest > 8) {
      violations.push(
        `Shortest sentence is ${shortest} words. Include at least one sentence of 8 words or fewer.`,
      );
    }
  }

  // 6. Grounding: a price-backed article must actually quote the price data.
  if (figures.length > 0) {
    const quoted = figures.some((value) => {
      const whole = Math.round(value);
      return (
        text.includes(value.toFixed(2)) ||
        text.includes(whole.toLocaleString('en-AU')) ||
        text.includes(String(whole))
      );
    });
    if (!quoted) {
      violations.push(
        'No figure from the supplied price data appears in the article. Quote the actual AUD numbers provided.',
      );
    }
  }

  return violations;
}

export const BANNED_PHRASE_LIST = BANNED_PHRASES;
