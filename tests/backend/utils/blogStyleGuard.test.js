import { describe, it, expect } from 'vitest';
import { checkDraft, stripHtml } from '../../../src/utils/blogStyleGuard.js';

// Build a body that passes every rule, so each test can break exactly one
// thing. Varied sentence lengths, one short sentence, no banned vocabulary,
// a single em-dash, and a figure from the price data.
const CLEAN_BODY = `
<h2>What a PSA 10 Charizard costs in Australia right now</h2>
<p>Across the three weeks to 25 July, graded copies averaged AUD $1,240. Raw copies sat at $310. That gap is the whole story.</p>
<p>Sellers keep pricing raw copies as though a 10 were guaranteed. It is not. On the last thirty listings we sampled, fewer than one in five slabs came back at the top grade, and the ones that did were already well centred before they went in. If you are buying raw at $400 hoping to flip a slab, you are paying for an outcome you have not earned yet.</p>
<h2>Where the spread actually comes from</h2>
<p>Two things drive it. Postage from the United States adds roughly forty dollars once tracking and insurance are included, and Australian buyers pay a premium for stock already onshore. Local listings clear faster.</p>
<p>Check the sold listings, not the asking prices. Asking prices tell you what optimistic sellers want.</p>
<h2>What we would do</h2>
<p>Buy graded if you want the card. Buy raw only if you can inspect the corners and the centring yourself, in person, and you are content to keep it raw. Grading a $310 card costs enough that the maths only works on a genuine 10.</p>
<ul>
  <li><strong>Buying to keep:</strong> raw is fine, and cheaper.</li>
  <li><strong>Buying to resell:</strong> graded, every time.</li>
</ul>
`;

const cleanDraft = () => ({
  title: 'What a PSA 10 Charizard costs in Australia right now',
  excerpt: 'Graded copies averaged AUD $1,240 across the three weeks to 25 July.',
  content: CLEAN_BODY,
});

// The clean fixture is shorter than a real article, so relax the word floor.
const opts = (extra = {}) => ({ figures: [1240, 310], minWords: 150, ...extra });

describe('stripHtml', () => {
  it('removes tags and collapses whitespace', () => {
    expect(stripHtml('<p>Hello   <strong>there</strong></p>')).toBe('Hello there');
  });

  it('decodes the entities that appear in stored article bodies', () => {
    expect(stripHtml('<p>PSA&nbsp;10 &amp; BGS</p>')).toBe('PSA 10 & BGS');
  });
});

describe('checkDraft', () => {
  it('passes a draft that follows the house style', () => {
    expect(checkDraft(cleanDraft(), opts())).toEqual([]);
  });

  it('rejects banned AI vocabulary', () => {
    const draft = cleanDraft();
    draft.content = draft.content.replace('That gap is the whole story.', 'Let us delve into that gap.');

    const violations = checkDraft(draft, opts());
    expect(violations.some((v) => v.includes('delve'))).toBe(true);
  });

  it('rejects the "not just X, it\'s Y" construction', () => {
    const draft = cleanDraft();
    draft.content = draft.content.replace(
      'That gap is the whole story.',
      "It's not just a card, it's an investment.",
    );

    const violations = checkDraft(draft, opts());
    expect(violations.some((v) => v.includes('not just'))).toBe(true);
  });

  it('rejects a filler opener', () => {
    const draft = cleanDraft();
    draft.content = draft.content.replace(
      '<p>Across the three weeks',
      "<p>Whether you're a seasoned collector or just starting out, prices matter. Across the three weeks",
    );

    const violations = checkDraft(draft, opts());
    expect(violations.some((v) => v.includes('filler hook'))).toBe(true);
  });

  it('rejects more than one em-dash in a single block', () => {
    const draft = cleanDraft();
    draft.content = draft.content.replace(
      '<p>Two things drive it.',
      '<p>Two things drive it — postage — and local demand.',
    );

    const violations = checkDraft(draft, opts());
    expect(violations.some((v) => v.includes('more than one em-dash'))).toBe(true);
  });

  it('rejects em-dash density above the per-section cap', () => {
    const body = `<h2>One</h2>${'<p>A short line — with a dash.</p>'.repeat(6)}`;
    const violations = checkDraft({ ...cleanDraft(), content: body }, opts({ minWords: 10 }));

    expect(violations.some((v) => v.includes('em-dashes across'))).toBe(true);
  });

  it('rejects uniformly long sentences', () => {
    // Twelve sentences of identical length: zero variance, nothing short.
    const sentence = 'The card market in Australia moved again this week for collectors and sellers alike.';
    const body = `<h2>Uniform</h2><p>${Array(12).fill(sentence).join(' ')}</p>`;

    const violations = checkDraft({ ...cleanDraft(), content: body }, opts({ minWords: 10, figures: [] }));
    expect(violations.some((v) => v.includes('too uniform'))).toBe(true);
    expect(violations.some((v) => v.includes('8 words or fewer'))).toBe(true);
  });

  it('rejects a draft that quotes none of the supplied price figures', () => {
    const draft = cleanDraft();
    draft.content = draft.content
      .replace('AUD $1,240', 'a high price')
      .replace('at $310', 'lower')
      .replace('raw at $400', 'raw')
      .replace('a $310 card', 'a cheap card');

    const violations = checkDraft(draft, opts());
    expect(violations.some((v) => v.includes('No figure from the supplied price data'))).toBe(true);
  });

  it('accepts a figure written with thousands separators', () => {
    const body = '<h2>Prices</h2><p>Graded copies averaged AUD $1,240 this week. That is the number.</p>';
    const violations = checkDraft({ ...cleanDraft(), content: body }, opts({ minWords: 5 }));

    expect(violations.some((v) => v.includes('No figure'))).toBe(false);
  });

  it('flags a body that is too short', () => {
    const violations = checkDraft({ ...cleanDraft(), content: '<h2>Hi</h2><p>Too short.</p>' }, opts());
    expect(violations.some((v) => v.includes('minimum is 150'))).toBe(true);
  });

  it('skips the grounding check when no price data was supplied', () => {
    const draft = cleanDraft();
    draft.content = '<h2>Explainer</h2><p>Grading is a condition assessment. It is not a valuation. Graders look at centring, corners, edges and surface, and they weight each of those differently depending on the company you send the card to.</p>';

    const violations = checkDraft(draft, { figures: [], minWords: 20 });
    expect(violations).toEqual([]);
  });
});
