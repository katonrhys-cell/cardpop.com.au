import React from 'react';
import { cn } from '@/lib/utils';

// Normalise the raw_data blob regardless of which CardSight SDK shape came back
function parsePop(rawData) {
  if (!rawData) return null;

  const total =
    rawData.totalPopulation ??
    rawData.total_population ??
    rawData.total ??
    null;

  // Collect grade rows from whichever shape is present
  let gradeRows = [];

  if (Array.isArray(rawData.grades)) {
    // [{ grade: "10", population: 450 }, ...]
    gradeRows = rawData.grades.map(g => ({
      grade: String(g.grade ?? g.label ?? ''),
      count: parseInt(g.population ?? g.pop ?? g.count ?? 0, 10),
    }));
  } else if (rawData.byGrade && typeof rawData.byGrade === 'object') {
    // { "10": 450, "9": 1200 }
    gradeRows = Object.entries(rawData.byGrade).map(([grade, count]) => ({
      grade,
      count: parseInt(count, 10),
    }));
  } else if (Array.isArray(rawData.population)) {
    gradeRows = rawData.population.map(g => ({
      grade: String(g.grade ?? g.label ?? ''),
      count: parseInt(g.count ?? g.population ?? 0, 10),
    }));
  }

  // Sort grades descending numerically (10 → 1)
  gradeRows.sort((a, b) => parseFloat(b.grade) - parseFloat(a.grade));

  // Remove rows with no pop
  gradeRows = gradeRows.filter(g => g.count > 0);

  return { total, gradeRows };
}

function fmt(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

/**
 * Displays PSA population data sourced from card_market_valuations (source='psa').
 *
 * Props:
 *   rawData   — the `raw_data` JSONB blob from the DB row, or null
 *   compact   — boolean; if true renders a single-line badge summary
 *   className — extra class names
 */
const PSAPopPanel = ({ rawData, compact = false, className }) => {
  const pop = parsePop(rawData);

  if (!pop) {
    if (compact) return null;
    return (
      <div className={cn('text-xs text-muted-foreground italic', className)}>
        No PSA population data available for this card.
      </div>
    );
  }

  if (compact) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-700 border border-red-500/20',
          className
        )}
      >
        PSA Pop {pop.total != null ? fmt(pop.total) : '—'}
      </span>
    );
  }

  // Find the max grade count for the bar chart
  const maxCount = pop.gradeRows.reduce((m, g) => Math.max(m, g.count), 1);

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">PSA Population Report</p>
        {pop.total != null && (
          <span className="text-xs font-bold text-red-700 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
            {pop.total.toLocaleString()} total graded
          </span>
        )}
      </div>

      {pop.gradeRows.length > 0 ? (
        <div className="space-y-1.5">
          {pop.gradeRows.map(({ grade, count }) => (
            <div key={grade} className="flex items-center gap-2">
              <span className="w-16 text-xs font-bold text-right text-foreground shrink-0">
                PSA {grade}
              </span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500/60 rounded-full transition-all"
                  style={{ width: `${Math.max(2, (count / maxCount) * 100)}%` }}
                />
              </div>
              <span className="w-14 text-xs text-muted-foreground text-right shrink-0">
                {count.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      ) : (
        pop.total != null && (
          <p className="text-xs text-muted-foreground">
            Grade breakdown not available — {pop.total.toLocaleString()} total graded.
          </p>
        )
      )}
    </div>
  );
};

export default PSAPopPanel;
