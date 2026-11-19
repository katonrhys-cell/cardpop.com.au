import React, { useEffect, useMemo } from 'react';
import { cleanHeadingStyle, headingFontsHref, headingSegmentCss } from '@/utils/organiserHeadingStyle.js';

// An organiser's name set in type that matches their logo
// (event_organisers.heading_style). With no usable style it renders the plain
// site heading, and the text is always the organiser's real name — the style
// only changes how it looks. docs/organiser-heading-style.md

/** Load the style's fonts (a few KB, subset to the name's characters). */
function useHeadingFonts(style) {
  const href = useMemo(() => headingFontsHref(style), [style]);
  useEffect(() => {
    if (!href || typeof document === 'undefined') return;
    if ([...document.querySelectorAll('link[data-organiser-heading]')].some((l) => l.href === href)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.organiserHeading = '';
    document.head.appendChild(link);
  }, [href]);
}

export default function OrganiserHeading({ name, headingStyle, as: Tag = 'h1', className = '' }) {
  const style = useMemo(() => cleanHeadingStyle(headingStyle, name), [headingStyle, name]);
  useHeadingFonts(style);
  if (!style) return <Tag className={`font-serif font-extrabold ${className}`}>{name}</Tag>;
  return (
    <Tag className={className}>
      {style.segments.map((segment, i) => (
        <React.Fragment key={`${i}-${segment.text}`}>
          {i > 0 && ' '}
          <span style={headingSegmentCss(segment)}>{segment.text}</span>
        </React.Fragment>
      ))}
    </Tag>
  );
}
