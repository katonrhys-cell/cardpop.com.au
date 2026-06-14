import React from 'react';
import { Link } from 'react-router-dom';
import { Camera, Loader2, Lightbulb } from 'lucide-react';

const scoreColor = (score) => {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-destructive';
};

const barColor = (score) => {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-amber-500';
  return 'bg-destructive';
};

/**
 * Shows the CardPop Photography Standard quality score for an uploaded image:
 * an overall /100 score plus a per-check breakdown with improvement hints.
 */
const PhotoQualityScore = ({ result, loading }) => {
  if (loading) {
    return (
      <div className="p-3 rounded-xl border border-border bg-muted/30 animate-in fade-in">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin" /> Checking photo quality…
        </p>
      </div>
    );
  }

  if (!result) return null;

  const lowChecks = result.checks.filter((c) => c.score < 70);

  return (
    <div className="p-3 rounded-xl border border-border bg-muted/30 animate-in fade-in space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold flex items-center gap-1.5 text-foreground">
          <Camera className="w-3.5 h-3.5" /> Photo Quality
        </h4>
        <span className={`text-sm font-bold ${scoreColor(result.overall)}`}>
          {result.overall}/100
        </span>
      </div>

      <div className="space-y-1.5">
        {result.checks.map((check) => (
          <div key={check.key} className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground w-24 shrink-0">{check.label}</span>
            <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
              <div
                className={`h-full rounded-full ${barColor(check.score)}`}
                style={{ width: `${check.score}%` }}
              />
            </div>
            <span className={`text-[11px] font-semibold w-7 text-right ${scoreColor(check.score)}`}>
              {check.score}
            </span>
          </div>
        ))}
      </div>

      {lowChecks.length > 0 && (
        <ul className="space-y-1 pt-1 border-t border-border/50">
          {lowChecks.map((check) => (
            <li key={check.key} className="text-[11px] text-muted-foreground flex gap-1.5">
              <Lightbulb className="w-3 h-3 shrink-0 mt-0.5 text-amber-500" />
              <span>{check.hint}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[11px] text-muted-foreground">
        Higher-quality photos build buyer confidence. See the{' '}
        <Link to="/photography-standard" className="text-primary hover:underline font-medium">
          CardPop Photography Standard
        </Link>
        .
      </p>
    </div>
  );
};

export default PhotoQualityScore;
