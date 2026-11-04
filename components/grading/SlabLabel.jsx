import React from 'react';
import GraderLogo from '@/components/grading/GraderLogo.jsx';
import { slabLabelLook, slabLabelTier } from '@/data/gradingCompanies.js';

function formatGrade(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n % 1 === 0 ? n.toFixed(0) : n.toFixed(1);
}

/**
 * The estimate drawn as the label at the top of that company's slab — PSA's red-banded
 * white label, BGS's silver / gold / Black Label with the four sub-grades, SGC's black
 * tuxedo label — with the company's mark on the left and the grade boxed on the right.
 * The look (`data/gradingCompanies.js` → `SLAB_LABEL_LOOKS`) is fixed stock colour, so it
 * does not follow the site theme.
 */
export default function SlabLabel({ grader, estimate, label, range, subGrades, className = '' }) {
  const look = slabLabelLook(grader, { estimate, subGrades });
  const tier = slabLabelTier(grader, { estimate, subGrades });
  const showSubs = Boolean(grader?.label?.showSubGrades && subGrades);
  const subs = showSubs ? Object.entries(subGrades) : [];
  const bodyFg = look.fg;

  return (
    <div
      className={`rounded-xl overflow-hidden border shadow-sm ${className}`}
      style={{ background: look.bg, color: bodyFg, borderColor: look.box.border }}
      data-slab-tier={tier}
      aria-label={`${grader.name} ${formatGrade(estimate)} ${label || ''}`.trim()}
    >
      {look.band && (
        <div className="flex items-center justify-between px-3 py-1.5" style={{ background: look.band.bg, color: look.band.fg }}>
          <GraderLogo grader={grader} height={16} tone="dark" ink={look.band.fg} wordmarkClassName="text-sm" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-90">Estimate</span>
        </div>
      )}

      <div className="flex items-stretch">
        <div className="flex-1 min-w-0 px-3 py-2.5">
          {!look.band && (
            <div className="flex items-center justify-between mb-1">
              <GraderLogo grader={grader} height={16} tone={look.dark ? 'dark' : 'light'} ink={bodyFg} wordmarkClassName="text-sm" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: look.muted }}>Estimate</span>
            </div>
          )}
          <div className="text-sm font-bold uppercase tracking-wide truncate">{label || '—'}</div>
          {range && (
            <div className="text-xs" style={{ color: look.muted }}>Range {range}</div>
          )}
          {subs.length > 0 && (
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] leading-tight">
              {subs.map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-2">
                  <dt className="capitalize" style={{ color: look.muted }}>{k}</dt>
                  <dd className="font-bold tabular-nums">{formatGrade(v)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <div
          className="w-[4.75rem] sm:w-20 flex-shrink-0 flex items-center justify-center border-l"
          style={{ background: look.box.bg, color: look.box.fg, borderColor: look.box.border }}
        >
          <span className="text-4xl font-black tabular-nums leading-none">{formatGrade(estimate)}</span>
        </div>
      </div>
    </div>
  );
}
