import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  cleanHeadingStyle, headingFontFaces, headingSegmentCss, HEADING_FONTS, HEADING_FONT_KEYS,
} from '@/utils/organiserHeadingStyle.js';

const NAME = 'Geelong Comic and Toy Fair';
const seg = (text, font, extra = {}) => ({ text, font, italic: false, case: 'upper', tracking: 'normal', ...extra });

describe('cleanHeadingStyle', () => {
  it('keeps a style whose segments spell the name, using the name’s own spelling', () => {
    // "Comic & Toy" is not "Comic and Toy": the heading can't be reworded.
    expect(cleanHeadingStyle({
      segments: [seg('GEELONG', 'league-gothic'), seg('Comic & Toy', 'bangers'), seg('fair', 'league-gothic')],
    }, NAME)).toBeNull();

    const ok = cleanHeadingStyle({
      layout: 'stacked',
      segments: [
        seg('GEELONG', 'league-gothic', { tracking: 'wider', fill: '#FFFFFF', outline: '#000000' }),
        seg('comic AND toy', 'bangers', { italic: true, shadow: '#F7941D', scale: 1.1 }),
        seg('fair', 'league-gothic'),
      ],
      source_fonts: ['League Gothic', '<b>Bangers</b>'],
    }, NAME);
    expect(ok.layout).toBe('stacked');
    expect(ok.segments.map((s) => s.text)).toEqual(['Geelong', 'Comic and Toy', 'Fair']);
    expect(ok.segments[0]).toMatchObject({ fill: '#ffffff', outline: '#000000' });
    expect(ok.segments[1]).toMatchObject({ italic: true, shadow: '#f7941d', scale: 1.1 });
    expect(ok.source_fonts).toEqual(['League Gothic', 'bBangers/b']);
  });

  it('drops unknown fonts, bad colours and options, and clamps the size', () => {
    const style = cleanHeadingStyle({
      layout: 'diagonal',
      segments: [
        seg('Geelong Comic and Toy', 'bangers', { shadow: 'red;background:url(x)', case: 'shout', tracking: '9em', italic: 'yes', scale: 9 }),
        seg('Fair', 'evil-font', { scale: 0.1 }),
      ],
    }, NAME);
    expect(style.layout).toBe('inline');
    expect(style.segments[0]).toEqual({
      text: 'Geelong Comic and Toy', font: 'bangers', italic: false, case: 'as-typed', tracking: 'normal',
      scale: 1.6, fill: null, outline: null, shadow: null,
    });
    expect(style.segments[1]).toMatchObject({ font: null, scale: 0.6 });
  });

  it('keeps a letter colour only with an outline, so it reads in light and dark mode', () => {
    const style = cleanHeadingStyle({ segments: [seg(NAME, 'anton', { fill: '#ffffff' })] }, NAME);
    expect(style.segments[0].fill).toBeNull();
  });

  it('still reads the first version’s accent as the shadow', () => {
    const style = cleanHeadingStyle({ segments: [seg(NAME, 'bangers', { accent: '#f28c1e' })] }, NAME);
    expect(style.segments[0].shadow).toBe('#f28c1e');
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
    const style = cleanHeadingStyle({ segments: [seg(NAME, 'league-gothic', {
      tracking: 'wider', fill: '#ffffff', outline: '#111111', shadow: '#f7941d', italic: true, scale: 1.2,
    })] }, NAME);
    const css = headingSegmentCss(style.segments[0]);
    expect(css.fontFamily).toContain("'League Gothic'");
    expect(css).toMatchObject({
      textTransform: 'uppercase', letterSpacing: '0.28em', fontStyle: 'italic', fontSize: '1.2em',
      color: '#ffffff', paintOrder: 'stroke fill',
    });
    expect(css.WebkitTextStroke).toContain('#111111');
    expect(css.textShadow).toContain('#f7941d');
  });

  it('loads each font once, from this site', () => {
    const style = cleanHeadingStyle({ segments: [seg('Geelong', 'league-gothic'), seg('Comic and Toy', 'oswald'), seg('Fair', 'league-gothic')] }, NAME);
    expect(headingFontFaces(style)).toEqual([
      { key: 'league-gothic', family: 'League Gothic', weight: 400, url: '/fonts/heading/league-gothic.woff2' },
      { key: 'oswald', family: 'Oswald', weight: 600, url: '/fonts/heading/oswald.woff2' },
    ]);
    expect(headingFontFaces(null)).toEqual([]);
  });

  it('every font has a self-hosted file, a fallback and a description for the reader', () => {
    for (const key of HEADING_FONT_KEYS) {
      const file = path.resolve(__dirname, '../../public/fonts/heading', `${key}.woff2`);
      expect(fs.existsSync(file), `${key}.woff2 is missing`).toBe(true);
      expect(fs.readFileSync(file).subarray(0, 4).toString('latin1')).toBe('wOF2');
      expect(HEADING_FONTS[key].family).toMatch(/^[A-Za-z0-9 ]+$/);
      expect(['serif', 'sans-serif', 'cursive', 'monospace']).toContain(HEADING_FONTS[key].fallback);
      expect(HEADING_FONTS[key].look.length).toBeGreaterThan(5);
    }
  });
});
