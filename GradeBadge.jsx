import React from 'react';
import { cn } from '@/lib/utils';

const GradeBadge = ({ grade, className }) => {
  if (!grade) return null;

  return (
    <div
      className={cn(
        "grade-badge absolute z-20 flex items-center justify-center",
        className
      )}
      aria-label={`Card Grade: ${grade}`}
    >
      {grade}
    </div>
  );
};

export default GradeBadge;