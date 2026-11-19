import { describe, it, expect } from 'vitest';
import {
  cleanHeadingStyle, headingFontsHref, headingSegmentCss, HEADING_FONTS, HEADING_FONT_KEYS,
} from '@/utils/organiserHeadingStyle.js';

const NAME = 'Geelong Comic and Toy Fair';
const seg = (text, font, extra = {}) => ({ text, font, italic: false, case: 'upper', tracking: 'normal', accent: null, ...extra });

describe('cleanHeadingStyle', () => {
  it('keeps a style whose segments spell the name, using the name’s own spelling', () => {
    const style = cleanHeadingStyle({
      segments: [seg('GEELONG', 'league-gothic', { tracking: 'wider' }), seg('Comic & Toy', 'bangers'), seg('fair', 'league-gothic')],
      source_fonts: ['League Gothic', 'Bangers'],
    }, NAME);
    // "Comic & Toy" is not "Comic and Toy": the heading can't be reworded.
    expect(style).toBeNull();

    const ok = cleanHeadingStyle({
      segments: [seg('GEELONG', 'league-gothic', { tracking: 'wider' }), seg('comic AND toy', 'bangers', { accent: '#F7941D' }), seg('fair', 'league-gothic')],
      source_fonts: ['League Gothic', '<b>Bangers</b>'],
    }, NAME);
    expect(ok.segments.map((s) => s.text)).toEqual(['Geelong', 'Comic and Toy', 'Fair']);
    expect(ok.segments[1].accent).toBe('#f7941d');
    expect(ok.source_fonts).toEqual(['League Gothic', 'bBangers/b']);
  });

  it('drops unknown fonts, bad colours and unknown options', () => {
    const style = cleanHeadingStyle({
      segments: [seg('Geelong Comic and Toy', 'bangers', { accent: 'red;background:url(x)', case: 'shout', tracking: '9em', italic: 'yes' }), seg('Fair', 'evil-font')],
    }, NAME);
    expect(style.segments[0]).toEqual({ text: 'Geelong Comic and Toy', font: 'bangers', italic: false, case: 'as-typed', tracking: 'normal', accent: null });
    expect(style.segments[1].font).toBeNull();
  });

  it('is null for nothing saved, a renamed organiser, missing words or no known font', () => {
    expect(cleanHeadingStyle(null, NAME)).toBeNull();
    expect(cleanHeadingStyle({ segments: 'x' }, NAME)).toBeNull();
    expect(cleanHeadingStyle({ segments: [seg(NAME, 'bangers')] }, 'Geelong Toy Fair')).toBeNull();
    expect(cleanHeadingStyle({ segments: [seg('Geelong Comic', 'bangers')] }, NAME)).toBeNull();
    expect(cleanHeadingStyle({ segments: [seg(NAME, 'nope')] }, NAME)).toBeNull();
  });

  it('keeps punctuation-only words with the neighbouring segment', () => {
    const style = cleanHeadingStyle({ segments: [seg('Cards', 'anton'), seg('Coffee', 'lobster')] }, 'Cards & Coffee');
    expect(style.segments.map((s) => s.text).join(' ')).toBe('Cards & Coffee');
  });
});

describe('heading CSS and fonts', () => {
  it('builds CSS from the fixed tables only', () => {
    const css = headingSegmentCss(seg('Fair', 'league-gothic', { tracking: 'wider', accent: '#f7941d', italic: true }));
    expect(css.fontFamily).toContain("'League Gothic'");
    expect(css).toMatchObject({ textTransform: 'uppercase', letterSpacing: '0.28em', fontStyle: 'italic' });
    expect(css.textShadow).toContain('#f7941d');
  });

  it('asks Google Fonts for just the fonts and characters in use', () => {
    const style = cleanHeadingStyle({ segments: [seg('Geelong', 'league-gothic'), seg('Comic and Toy Fair', 'oswald')] }, NAME);
    const href = headingFontsHref(style);
    expect(href.startsWith('https://fonts.googleapis.com/css2?family=League+Gothic&family=Oswald:wght@600&display=swap&text=')).toBe(true);
    expect(decodeURIComponent(href.split('text=')[1])).toContain('G');
    expect(headingFontsHref(null)).toBeNull();
  });

  it('every font has a family, a fallback and a description for the reader', () => {
    for (const key of HEADING_FONT_KEYS) {
      expect(HEADING_FONTS[key].family).toMatch(/^[A-Za-z0-9 ]+$/);
      expect(['serif', 'sans-serif', 'cursive', 'monospace']).toContain(HEADING_FONTS[key].fallback);
      expect(HEADING_FONTS[key].look.length).toBeGreaterThan(5);
    }
  });
});
