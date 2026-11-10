import React from 'react';
import GraderLogo from '@/components/grading/GraderLogo.jsx';
import { slabLabelLook, slabLabelTier } from '@/data/gradingCompanies.js';

function formatGrade(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n % 1 === 0 ? n.toFixed(0) : n.toFixed(1);
}

/**
 * The estimate drawn as the label at the top of that company's slab — PSA's red-framed
 * white label with the mark along the bottom, SGC's black strip over a white panel, TAG's
 * black label with its white inset frame, Beckett's silver / gold / Black Label with the four sub-grades in a
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
  const logoAtBottom = look.logoAt === 'bottom';
  const logoAtTop = look.logoAt === 'top';
  const logoInBand = Boolean(look.band?.logo);
  const logoInRow = !logoAtBottom && !logoAtTop && !logoInBand;
  const logo = (h, cls) => <GraderLogo grader={grader} height={h} tone={logoTone} ink={look.fg} wordmarkClassName={cls} />;

  return (
    <div
      className={`overflow-hidden shadow-sm ${look.frame ? 'rounded-md border-4' : 'rounded-xl border'} ${look.inset ? 'p-1.5' : ''} ${className}`}
      style={{ background: look.bg, color: look.fg, borderColor: look.frame || box.border }}
      data-slab-tier={tier}
      aria-label={`${grader.name} ${formatGrade(estimate)} ${label || ''}`.trim()}
    >
      {look.band && (logoInBand ? (
        <div className="flex items-center justify-between px-3 py-1.5" style={{ background: look.band.bg, color: look.band.fg }}>
          <GraderLogo grader={grader} height={16} tone="dark" ink={look.band.fg} wordmarkClassName="text-sm" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-90">Estimate</span>
        </div>
      ) : (
        <div className="h-1.5" style={{ background: look.band.bg }} />
      ))}

      {/* `inset`: a thin frame inside the label, the mark sitting on its top edge (TAG) */}
      <div className={look.inset ? 'relative border rounded-sm mt-2.5' : ''} style={look.inset ? { borderColor: look.inset } : undefined}>
      {logoAtTop && (
        <div className="absolute left-1/2 -translate-x-1/2 -top-2.5 px-2 leading-none" style={{ background: look.bg }}>
          {logo(18, 'text-sm')}
        </div>
      )}

      <div className="flex items-stretch">
        <div className="flex-1 min-w-0 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            {logoInRow
              ? logo(22, 'text-base')
              : <span className="text-[11px] font-bold uppercase tracking-wide whitespace-nowrap">Grade estimate</span>}
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: look.muted }}>{logoInRow ? 'Estimate' : 'Preliminary'}</span>
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
          className={`w-[5.5rem] flex-shrink-0 flex flex-col justify-center px-2 ${box.align === 'end' ? 'items-end text-right' : 'items-center text-center'} ${box.slant ? '-ml-4 pl-4' : 'border-l'} ${box.wordAbove ? 'flex-col-reverse' : ''}`}
          style={{
            background: box.bg,
            color: box.fg,
            borderColor: box.border,
            clipPath: box.slant ? 'polygon(22% 0, 100% 0, 100% 100%, 0 100%)' : undefined,
          }}
        >
          <span className="text-3xl font-black tabular-nums leading-none">{formatGrade(estimate)}</span>
          {label && (
            <span
              className={`text-[9px] font-bold uppercase tracking-wide leading-tight ${box.wordAbove ? 'mb-1' : 'mt-1'} ${box.badge ? 'rounded-sm px-1 py-0.5' : ''}`}
              style={box.badge ? { background: box.badge.bg, color: box.badge.fg } : undefined}
            >
              {label}
            </span>
          )}
        </div>
      </div>

      {logoAtBottom && (
        <div className="flex items-center justify-center px-3 pb-2 -mt-1">
          {logo(18, 'text-sm')}
        </div>
      )}
      </div>
    </div>
  );
}
