#!/usr/bin/env node
/**
 * Scores the card-identification pipeline against labelled fixtures.
 *
 *   node scripts/score-card-identification.mjs
 *   node scripts/score-card-identification.mjs --case charizard-base-set
 *   node scripts/score-card-identification.mjs --crop        # also measure rectification
 *   node scripts/score-card-identification.mjs --json > before.json
 *
 * Fixtures and how to add to them: tests/fixtures/card-identification/README.md
 *
 * This runs the real pipeline — the same prompt, escalation policy, grounding
 * rules, segment map and CardSight ranking the app uses, imported from the same
 * modules. The one thing it re-implements is the *orchestration order*, which
 * lives in `handleAnalyzeWithAI` in pages/AddEditCardPage.jsx and is welded to
 * React state. Keep the two in step; the stage comments below mirror it.
 *
 * Needs ANTHROPIC_API_KEY, and CARDSIGHT_API_KEY for the catalog stage — no
 * database credentials are required for either. Every run costs real API calls;
 * this is a manual tool, deliberately not part of CI.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { runCardOcr, parseOcrJson } from '../src/utils/cardOcr.js';
import { mapOCRResult, catalogueCollectionParam } from '../utils/ocrResult.js';
import { groundAgainstCatalogue, buildCatalogueQuery } from '../utils/catalogueGrounding.js';
import { getSegmentsForCollection } from '../src/utils/collectionSegmentMap.js';
import { rankCandidates, hasAmbiguousWinner } from '../src/utils/cardsightRanking.js';
import { isLowConfidence } from '../utils/cardsightConfidence.js';
import { resolveVariantChips } from '../lib/cardVariants.js';
import { scoreCase, summarise, formatSummary, VERDICT, SCORED_FIELDS } from '../utils/identificationScore.js';
import { isExactMatch, hasParallel, getParallelInfo } from 'cardsightai';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = path.join(REPO_ROOT, 'tests/fixtures/card-identification');
const CATALOG_BASE = process.env.CATALOG_BASE_URL || 'https://cardpop.com.au/hcgi/api';

// ─── args ─────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const flag = name => argv.includes(name);
const opt = name => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : null;
};

const options = {
  json: flag('--json'),
  // Opt-in: rectification needs headless Chromium to evaluate the ~10 MB
  // OpenCV module, which blocks the renderer's main thread while Emscripten
  // compiles it and does not complete on constrained hardware. A default run
  // scores the OCR → grounding → CardSight path on the original photos.
  crop: flag('--crop'),
  only: opt('--case'),
};

const out = options.json ? () => {} : (...a) => console.log(...a);

// ─── pipeline ─────────────────────────────────────────────────────────────────

/** Stage 1: OCR, then ground the read against the public TCG catalogue. */
async function readCard(images, log) {
  const { content, escalated, reason } = await runCardOcr({
    apiKey: process.env.ANTHROPIC_API_KEY,
    imageBlocks: images.map(({ buffer, mimetype }) => ({
      type: 'image',
      source: { type: 'base64', media_type: mimetype, data: buffer.toString('base64') },
    })),
    log,
  });

  const parsed = parseOcrJson(content);
  if (!parsed) return { ocr: null, escalated, reason };

  const mapped = mapOCRResult(parsed);
  const grounded = await groundAgainstCatalogue(
    mapped,
    params => fetchCatalogue(params),
    catalogueCollectionParam(mapped.collectionType),
  );
  return { ocr: grounded, escalated, reason };
}

async function fetchCatalogue(params) {
  const url = `${CATALOG_BASE}/catalog/search?${new URLSearchParams(params)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`catalog ${res.status}`);
  return res.json();
}

/** Stage 3: CardSight, narrowed to the segment the category implies. */
async function identifyWithCardSight(buffer, mimetype, collection, log) {
  const segments = getSegmentsForCollection(collection);
  if (!segments.length) {
    log(`CardSight skipped — "${collection}" is not in its catalog`);
    return null;
  }

  // Imported lazily so a run that only scores the OCR path never touches the
  // CardSight SDK at all.
  let client;
  try {
    const { getCardSightClient } = await import('../src/utils/cardSightClient.js');
    client = getCardSightClient();
  } catch (err) {
    log(`CardSight skipped — ${err.message}`);
    return null;
  }

  const image = new File([buffer], 'card.jpg', { type: mimetype });
  const settled = await Promise.allSettled(
    segments.map(seg => client.identify.cardBySegment(seg, image)),
  );

  const candidates = [];
  settled.forEach((r, i) => {
    if (r.status !== 'fulfilled' || !r.value?.data) return;
    for (const detection of r.value.data.detections ?? []) {
      if (detection?.card) candidates.push({ detection, segment: segments[i] });
    }
  });
  if (!candidates.length) return null;

  const ranked = rankCandidates(candidates);
  const best = ranked[0].detection;
  return {
    card: best.card,
    parallel: hasParallel(best) ? (getParallelInfo(best)?.name ?? null) : null,
    confidence: best.confidence,
    segment: ranked[0].segment,
    exactMatch: isExactMatch(best),
    ambiguous: hasAmbiguousWinner(ranked),
    segmentsSearched: segments.length,
  };
}

/**
 * Runs one fixture through the whole pipeline and returns the fields a seller
 * would end up with. Mirrors handleAnalyzeWithAI: OCR fills the form, then a
 * CardSight hit overlays it only when the match is trustworthy.
 */
async function runCase(fixture, rectifier, log) {
  // A fixture may carry several angles. Production sends the front plus up to
  // two extras to OCR — the back is where collector numbers and copyright lines
  // usually live — but only ever the front to CardSight.
  const names = (fixture.images ?? [fixture.image]).filter(Boolean).slice(0, 3);
  if (!names.length) throw new Error('fixture has no image');

  const images = names.map(name => {
    const imagePath = path.join(FIXTURES, 'images', name);
    if (!fs.existsSync(imagePath)) throw new Error(`missing image: ${name}`);
    return {
      name,
      path: imagePath,
      buffer: fs.readFileSync(imagePath),
      mimetype: name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg',
    };
  });

  // Stage 0 — rectify the card out of the front photo (only the front, as in
  // the app: cropping every angle would double the wait for a secondary read).
  let cropped = false;
  if (rectifier) {
    const res = await rectifier.rectify(path.relative(REPO_ROOT, images[0].path), images[0].name);
    images[0].buffer = res.buffer;
    cropped = res.cropped;
    log(cropped ? 'rectified' : 'no card outline found — using original');
  }

  const { ocr, escalated, reason } = await readCard(images, log);
  if (!ocr) return { fields: {}, meta: { cropped, escalated, escalationReason: reason, ocrFailed: true } };

  const fields = {
    name: ocr.name,
    setName: ocr.cardSetName,
    cardNumber: ocr.cardNumber,
    year: ocr.releaseYear,
    collection: ocr.collectionType,
    insert: ocr.insertName,
    rookie: ocr.rookie,
    // Resolved the same way the listing form resolves them, so the harness
    // scores the chips a seller would actually end up with.
    variants: resolveVariantChips(
      [...(ocr.attributes ?? []), ...(ocr.serialNumber ? ['Numbered'] : [])],
      ocr.collectionType,
    ),
    // Grading comes off the slab label via OCR and is applied to the form
    // directly (handleAnalyzeWithAI), independent of any CardSight match.
    gradingCompany: ocr.gradingService === 'None' ? '' : ocr.gradingService,
    grade: ocr.gradeScore,
    certNumber: ocr.certificationNumber,
    // Only CardSight can fill this: mapCardSightToFormFields sets parallelName,
    // while OCR's `cardType` read goes into the notes and never reaches a field.
    // Left blank here on purpose so the harness shows that gap rather than
    // papering over it.
    parallel: '',
  };

  // Stage 2 — the category OCR read chooses the segment. Front only.
  const cardsight = await identifyWithCardSight(images[0].buffer, images[0].mimetype, ocr.collectionType, log);

  // Stage 4 — overlay only on a clean exact hit.
  const trustworthy = Boolean(
    cardsight?.exactMatch && !cardsight.ambiguous && !isLowConfidence(cardsight.confidence),
  );
  if (trustworthy) {
    const c = cardsight.card;
    if (c?.name) fields.name = c.name;
    if (c?.setName) fields.setName = c.setName;
    if (c?.number) fields.cardNumber = c.number;
    if (c?.year) fields.year = String(c.year);
    if (cardsight.parallel) fields.parallel = cardsight.parallel;
  }

  return {
    fields,
    meta: {
      cropped,
      imageCount: images.length,
      escalated,
      escalationReason: reason,
      catalogueVerified: ocr.catalogueMatch?.verified ?? null,
      catalogueQuery: buildCatalogueQuery(ocr, catalogueCollectionParam(ocr.collectionType)),
      cardsight: cardsight && {
        segment: cardsight.segment,
        segmentsSearched: cardsight.segmentsSearched,
        confidence: cardsight.confidence,
        exactMatch: cardsight.exactMatch,
        ambiguous: cardsight.ambiguous,
        applied: trustworthy,
      },
    },
  };
}

// ─── reporting ────────────────────────────────────────────────────────────────

const MARK = { [VERDICT.CORRECT]: '✓', [VERDICT.WRONG]: '✗', [VERDICT.MISSING]: '·', [VERDICT.UNSCORED]: ' ' };

function reportCase(id, score, meta) {
  const flags = [
    meta.cropped ? 'cropped' : null,
    meta.escalated ? `escalated(${meta.escalationReason})` : null,
    meta.cardsight?.applied ? `cardsight:${meta.cardsight.segment}` : null,
    meta.cardsight?.ambiguous ? 'AMBIGUOUS' : null,
  ].filter(Boolean).join(' ');

  out(`\n${score.wrong.length ? '✗' : '✓'} ${id}${flags ? `   [${flags}]` : ''}`);
  for (const field of SCORED_FIELDS) {
    const f = score.fields[field];
    if (f.verdict === VERDICT.UNSCORED) continue;
    const detail = f.verdict === VERDICT.CORRECT
      ? f.actual
      : `got ${JSON.stringify(f.actual)}, want ${JSON.stringify(f.expected)}`;
    out(`    ${MARK[f.verdict]} ${field.padEnd(11)} ${detail}`);
  }
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is required.');
    process.exit(1);
  }

  const manifest = path.join(FIXTURES, 'cases.json');
  const cases = JSON.parse(fs.readFileSync(manifest, 'utf8'))
    .filter(c => !options.only || c.id === options.only);

  if (!cases.length) {
    console.error(
      options.only
        ? `No fixture with id "${options.only}".`
        : `No fixtures yet. Add photos and entries — see ${path.relative(REPO_ROOT, path.join(FIXTURES, 'README.md'))}`,
    );
    process.exit(1);
  }

  let rectifier = null;
  if (options.crop) {
    out('Building rectification harness (Vite + headless Chromium)…');
    rectifier = await createRectifierOrWarn();
  }

  const results = [];
  try {
    for (const fixture of cases) {
      const log = msg => out(`    · ${fixture.id}: ${msg}`);
      try {
        const { fields, meta } = await runCase(fixture, rectifier, log);
        const score = scoreCase(fixture.expected, fields);
        results.push({ id: fixture.id, score, meta, actual: fields, notes: fixture.notes });
        reportCase(fixture.id, score, meta);
      } catch (err) {
        out(`\n! ${fixture.id}: ${err.message}`);
        results.push({ id: fixture.id, error: err.message });
      }
    }
  } finally {
    await rectifier?.close();
  }

  const scored = results.filter(r => r.score);
  const summary = summarise(scored);

  if (options.json) {
    console.log(JSON.stringify({ summary, results, options }, null, 2));
  } else {
    out('');
    out(formatSummary(summary));
    const failed = results.filter(r => r.error);
    if (failed.length) out(`\n${failed.length} case(s) errored and were not scored.`);
  }

  // Non-zero when anything came back wrong, so this can gate a manual check.
  process.exit(summary.totals.wrong > 0 ? 1 : 0);
}

async function createRectifierOrWarn() {
  try {
    const { createRectifier } = await import('./card-identification/rectifier.mjs');
    return await createRectifier();
  } catch (err) {
    out(`Rectification unavailable (${err.message}) — scoring original photos instead.`);
    return null;
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
