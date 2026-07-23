import React from 'react';
import { Check } from 'lucide-react';

/**
 * Numbered step indicator for the listing wizard. Steps up to `maxReached`
 * are clickable (going back or revisiting is always allowed); later steps are
 * disabled — moving forward goes through the Next button so each step's
 * validation runs.
 */
const WizardStepper = ({ steps, current, maxReached, onStepSelect }) => (
  <ol className="flex items-center justify-center" aria-label="Listing steps">
    {steps.map((step, i) => {
      const reachable = i <= maxReached;
      const isCurrent = i === current;
      const done = i < current;
      return (
        <li key={step.key} className="flex items-center">
          {i > 0 && <div className={`h-px w-5 sm:w-10 mx-1 sm:mx-2 ${i <= maxReached ? 'bg-primary/50' : 'bg-border'}`} aria-hidden="true" />}
          <button
            type="button"
            disabled={!reachable}
            aria-current={isCurrent ? 'step' : undefined}
            onClick={() => reachable && onStepSelect(i)}
            className={`flex items-center gap-1.5 sm:gap-2 rounded-full py-1 pl-1 pr-2 sm:pr-3 text-xs sm:text-sm font-bold transition-colors ${
              isCurrent
                ? 'text-foreground'
                : reachable
                  ? 'text-muted-foreground hover:text-foreground'
                  : 'text-muted-foreground/50 cursor-not-allowed'
            }`}
          >
            <span
              className={`flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-full border-2 text-[11px] sm:text-xs ${
                isCurrent
                  ? 'border-primary bg-primary text-primary-foreground'
                  : done
                    ? 'border-primary/60 bg-primary/10 text-primary'
                    : 'border-border bg-background'
              }`}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className="hidden sm:inline">{step.title}</span>
          </button>
        </li>
      );
    })}
  </ol>
);

export default WizardStepper;
