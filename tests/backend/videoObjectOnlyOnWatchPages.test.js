import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Google indexes a video only on a "watch page" — a page whose main content is
// that one video. A VideoObject emitted on any other page (an event, an
// article, a card shop) is reported in Search Console as "Video isn't on a
// watch page" and the video is never served as a video result. That happened
// to every event video in November 2026.
//
// So the markup has exactly one home: utils/videoWatch.js, which builds it for
// the watch page (<parent>/videos/<key>) and nothing else. A page that gains
// videos gets a `…WatchSource()` there instead of its own VideoObject — see
// docs/video-watch-pages.md.

const ROOT = join(import.meta.dirname, '..', '..');
const SOURCE_DIRS = ['api', 'components', 'contexts', 'data', 'hooks', 'lib', 'pages', 'server', 'src', 'utils'];
const ALLOWED = new Set(['utils/videoWatch.js']);

const sourceFiles = (dir) => readdirSync(dir).flatMap((name) => {
  const full = join(dir, name);
  if (statSync(full).isDirectory()) return name === 'node_modules' ? [] : sourceFiles(full);
  return /\.(js|jsx|mjs)$/.test(name) ? [full] : [];
});

describe('VideoObject markup', () => {
  it('is only ever built by utils/videoWatch.js, for a watch page', () => {
    const offenders = SOURCE_DIRS
      .flatMap((dir) => sourceFiles(join(ROOT, dir)))
      .map((file) => relative(ROOT, file).split('\\').join('/'))
      .filter((file) => !ALLOWED.has(file))
      // The type as a string literal — a comment that mentions it is fine.
      .filter((file) => /['"`]VideoObject['"`]/.test(readFileSync(join(ROOT, file), 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('is built there', () => {
    expect(readFileSync(join(ROOT, 'utils/videoWatch.js'), 'utf8')).toContain("'@type': 'VideoObject'");
  });
});
