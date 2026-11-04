import React from 'react';
import GraderLogo from '@/components/grading/GraderLogo.jsx';
import { slabLabelLook, slabLabelTier } from '@/data/gradingCompanies.js';

function formatGrade(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n % 1 === 0 ? n.toFixed(0) : n.toFixed(1);
}

/**
 * The estimate drawn as the label at the top of that company's slab — PSA's white label
 * under its red rule (`band`), Beckett's silver / gold / Black Label with the four sub-grades in a
 * row, ACE's navy label with the angled Gem Mint panel, SGC's black tuxedo label — with
 * the company's mark on the left and the grade, its word beneath it, on the right.
 * The look (`data/gradingCompanies.js` → `SLAB_LABEL_LOOKS`) is fixed label stock, so it
 * does not follow the site theme.
 */
export default function SlabLabel({ grader, estimate, label, range, subGrades, className = '' }) {
  const look = slabLabelLook(grader, { estimate, subGrades });
  const tier = slabLabelTier(grader, { estimate, subGrades });
  const showSubs = Boolean(grader?.label?.showSubGrades && subGrades);
  const subs = showSubs ? Object.entries(subGrades) : [];
  const { box } = look;
  const logoTone = look.dark ? 'dark' : 'light';

  return (
    <div
      className={`rounded-xl overflow-hidden border shadow-sm ${className}`}
      style={{ background: look.bg, color: look.fg, borderColor: box.border }}
      data-slab-tier={tier}
      aria-label={`${grader.name} ${formatGrade(estimate)} ${label || ''}`.trim()}
    >
      {look.band && <div className="h-1.5" style={{ background: look.band.bg }} />}

      <div className="flex items-stretch">
        <div className="flex-1 min-w-0 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <GraderLogo grader={grader} height={22} tone={logoTone} ink={look.fg} wordmarkClassName="text-base" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: look.muted }}>Estimate</span>
          </div>
          {range && (
            <div className="mt-1.5 text-xs font-medium" style={{ color: look.muted }}>Range {range}</div>
          )}
          {subs.length > 0 && (
            <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] leading-tight uppercase">
              {subs.map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-2">
                  <dt className="tracking-wide" style={{ color: look.muted }}>{k}</dt>
                  <dd className="font-bold tabular-nums">{formatGrade(v)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <div
          className={`w-[5.5rem] flex-shrink-0 flex flex-col items-center justify-center px-1 text-center ${box.slant ? '-ml-4 pl-4' : 'border-l'}`}
          style={{
            background: box.bg,
            color: box.fg,
            borderColor: box.border,
            clipPath: box.slant ? 'polygon(22% 0, 100% 0, 100% 100%, 0 100%)' : undefined,
          }}
        >
          <span className="text-3xl font-black tabular-nums leading-none">{formatGrade(estimate)}</span>
          {label && (
            <span className="mt-1 text-[9px] font-bold uppercase tracking-wide leading-tight">{label}</span>
          )}
        </div>
      </div>
    </div>
  );
}
