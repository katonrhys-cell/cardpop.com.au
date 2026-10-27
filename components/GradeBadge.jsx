import React from 'react';
import { cn } from '@/lib/utils';

// White 11px text needs a 4.5:1 background (WCAG AA): green-600 (3.3:1) and
// orange-500 (2.8:1) failed the e2e axe check once a CGC slab reached
// /marketplace, so CGC and ACE use the 700 shades.
export const GRADE_BADGE = {
  psa:   'bg-red-600 text-white',
  bgs:   'bg-blue-700 text-white',
  cgc:   'bg-green-700 text-white',
  ace:   'bg-orange-700 text-white',
  sgc:   'bg-purple-600 text-white',
  other: 'bg-slate-600 text-white',
};

const GradeBadge = ({ grade, gradingCompany = '', className, isPositioned = true }) => {
  if (!grade) return null;

  const baseClasses = 'px-2.5 py-1 rounded-md text-[11px] font-extrabold tracking-wide shadow-lg';
  const gradingCompanyLower = (gradingCompany || '').toLowerCase();
  const badgeStyles = GRADE_BADGE[gradingCompanyLower] || GRADE_BADGE.other;

  const positionClasses = isPositioned ? 'absolute bottom-3 left-3 z-10' : '';

  const displayText = gradingCompany
    ? `${gradingCompany.toUpperCase()} ${grade}`.toUpperCase()
    : grade.toString().toUpperCase();

  return (
    <div
      className={cn(
        'grade-badge flex items-center justify-center',
        baseClasses,
        badgeStyles,
        positionClasses,
        className
      )}
      aria-label={`Card Grade: ${displayText}`}
    >
      {displayText}
    </div>
  );
};

export default GradeBadge;