import React, { useState } from 'react';
import { graderStyle } from '@/data/gradingCompanies.js';

/**
 * A grading company's logo: the official file from `public/images/grading/` when it is
 * there, else a wordmark in the company's brand colour. Never redraws a mark — the
 * fallback is plain text so a missing or broken file can't ship as a near-miss logo.
 *
 * `logoDark` (where the company publishes a light-on-dark version) swaps in under the
 * `dark` class; otherwise the one file is shown on both themes.
 */
export default function GraderLogo({ grader, height = 24, className = '', wordmarkClassName = '' }) {
  const [failed, setFailed] = useState(false);
  if (!grader) return null;

  const showImage = Boolean(grader.logo) && !failed;
  const alt = `${grader.full || grader.name} logo`;

  return (
    <span
      className={`inline-flex items-center ${className}`}
      style={{ ...graderStyle(grader), height }}
      data-grader={grader.key}
    >
      {showImage ? (
        <>
          <img
            src={grader.logo}
            alt={alt}
            height={height}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
            className={`h-full w-auto max-w-[9rem] object-contain ${grader.logoDark ? 'dark:hidden' : ''}`}
          />
          {grader.logoDark && (
            <img
              src={grader.logoDark}
              alt={alt}
              height={height}
              loading="lazy"
              decoding="async"
              onError={() => setFailed(true)}
              className="hidden h-full w-auto max-w-[9rem] object-contain dark:block"
            />
          )}
        </>
      ) : (
        <span
          className={`font-black tracking-tight leading-none text-[var(--grader-ink)] dark:text-[var(--grader-ink-dark)] ${wordmarkClassName}`}
          aria-label={alt}
        >
          {grader.name}
        </span>
      )}
    </span>
  );
}
