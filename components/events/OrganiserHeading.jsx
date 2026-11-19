import React, { useEffect, useMemo, useState } from 'react';
import { cleanHeadingStyle, headingFontFaces, headingSegmentCss } from '@/utils/organiserHeadingStyle.js';

// An organiser's name set in type that matches their logo
// (event_organisers.heading_style). With no usable style it renders the plain
// site heading, and the text is always the organiser's real name — the style
// only changes how it looks. docs/organiser-heading-style.md

const registered = new Map(); // key → Promise, so each font file loads once per page

/** Load the style's fonts from our own origin through the FontFace API. */
function loadHeadingFonts(faces) {
  if (typeof document === 'undefined' || typeof FontFace === 'undefined' || !document.fonts) return Promise.resolve();
  return Promise.all(faces.map(({ key, family, weight, url }) => {
    if (!registered.has(key)) {
      const face = new FontFace(family, `url(${url}) format('woff2')`, { weight: String(weight), display: 'swap' });
      document.fonts.add(face);
      registered.set(key, face.load().catch(() => {}));
    }
    return registered.get(key);
  }));
}

export default function OrganiserHeading({ name, headingStyle, as: Tag = 'h1', className = '' }) {
  const style = useMemo(() => cleanHeadingStyle(headingStyle, name), [headingStyle, name]);
  const faces = useMemo(() => headingFontFaces(style), [style]);
  const [, setLoaded] = useState(0);
  useEffect(() => {
    let live = true;
    // Re-render once the files are in, so nothing waits on a font-swap repaint.
    loadHeadingFonts(faces).then(() => { if (live) setLoaded((n) => n + 1); });
    return () => { live = false; };
  }, [faces]);

  if (!style) return <Tag className={`font-serif font-extrabold ${className}`}>{name}</Tag>;
  const stacked = style.layout === 'stacked';
  return (
    <Tag className={className}>
      {/* Stacked: one line per segment, centred on each other like the logo's lines. */}
      <span className={stacked ? 'inline-flex flex-col items-center leading-[1.05]' : undefined}>
        {style.segments.map((segment, i) => (
          <React.Fragment key={`${i}-${segment.text}`}>
            {i > 0 && !stacked && ' '}
            <span className={stacked ? 'block' : undefined} style={headingSegmentCss(segment)}>{segment.text}</span>
          </React.Fragment>
        ))}
      </span>
    </Tag>
  );
}
