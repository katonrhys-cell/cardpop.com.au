import React from 'react';
import { cn } from '@/lib/utils';
import { conditionToneClass, vaultSlabStyle } from '@/utils/vaultGradeStyle.js';

// PSA prints its name in red on the white label; the frame red itself is too light for 11px text.
const PSA_MARK = '#C8102E';

const SHAPE = 'inline-flex items-stretch overflow-hidden rounded-md border text-xs font-extrabold uppercase whitespace-nowrap leading-none';

/**
 * A vault card's Condition / Grade chip. A graded slab wears its company's label — PSA's
 * red-framed white label, BGS silver / gold / Black Label, CGC black or gold, ACE navy or
 * gold, SGC's black-and-white, TAG's black — chosen from what the owner listed it as; a raw
 * card gets a condition tone (mint green → red for played).
 */
export default function ConditionGradeBadge({ gradingCompany, grade, condition, className }) {
  const company = String(gradingCompany || '').toLowerCase();
  const isGraded = company && company !== 'raw';

  if (isGraded && grade) {
    const slab = vaultSlabStyle(company, grade);
    const name = slab ? slab.grader.name : company.toUpperCase();
    // The owner may have typed "PSA 10" into the grade box already.
    const gradeText = String(grade).replace(new RegExp(`^\\s*${name}\\s+`, 'i'), '').trim();

    if (!slab) {
      return (
        <span className={cn(SHAPE, 'border-border bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100', className)} data-slab-tier="other">
          <span className="px-2 py-1">{name}</span>
          <span className="px-2 py-1 border-l border-border/60">{gradeText}</span>
        </span>
      );
    }

    const { look, tier } = slab;
    const { box, band } = look;
    const ring = look.frame || box.border;
    return (
      <span
        className={cn(SHAPE, look.frame ? 'border-2' : '', className)}
        style={{
          background: look.bg,
          color: look.fg,
          borderColor: ring,
          // TAG's thin white frame inside the black label
          boxShadow: look.inset ? `inset 0 0 0 2px ${look.bg}, inset 0 0 0 3px ${look.inset}` : undefined,
        }}
        data-slab-tier={tier}
        aria-label={`${name} ${gradeText}`}
      >
        <span
          className="px-2 py-1"
          style={band
            ? { background: band.bg, color: band.fg }
            : (tier === 'psa' ? { color: PSA_MARK } : undefined)}
        >
          {name}
        </span>
        <span
          className="px-2 py-1"
          style={{ background: box.bg === 'transparent' ? undefined : box.bg, color: box.fg }}
        >
          {gradeText}
        </span>
      </span>
    );
  }

  const label = String(condition || '').replace(/_/g, ' ') || 'Unknown';
  return (
    <span className={cn(SHAPE, 'px-2.5 py-1 normal-case capitalize font-semibold', conditionToneClass(condition), className)} data-condition={condition || 'unknown'}>
      {label}
    </span>
  );
}
