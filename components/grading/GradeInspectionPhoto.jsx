import React, { useState } from 'react';
import { cornerRegions } from '@/utils/gradeFindings.js';

/**
 * The member's own photo with the estimate drawn on it: the card's outline, the
 * centering ratios, the corners / edges being talked about, and a numbered box on
 * every located finding. Everything is positioned in percent of the photo, so the
 * overlay scales with the image at any width.
 *
 * Purely presentational — the page owns which factor, side and finding are active.
 */

export const SEVERITY_STYLES = {
  minor: { ring: '#f59e0b', fill: 'rgba(245, 158, 11, 0.16)', label: 'Minor' },
  moderate: { ring: '#f97316', fill: 'rgba(249, 115, 22, 0.18)', label: 'Moderate' },
  major: { ring: '#CE1126', fill: 'rgba(206, 17, 38, 0.2)', label: 'Major' },
};

// The colour a factor's general highlight takes, from its score.
export const SCORE_COLOURS = {
  excellent: '#10b981',
  good: '#22c55e',
  fair: '#f59e0b',
  poor: '#CE1126',
};

const pct = (n) => `${n}%`;
const boxStyle = (b) => ({ left: pct(b.x), top: pct(b.y), width: pct(b.w), height: pct(b.h) });

function CenteringGuides({ box, centering }) {
  if (!box) return null;
  return (
    <div className="absolute pointer-events-none" style={boxStyle(box)} data-overlay="centering">
      {/* centre lines */}
      <div className="absolute left-1/2 top-0 bottom-0 border-l-2 border-dashed border-white/90 mix-blend-difference" />
      <div className="absolute top-1/2 left-0 right-0 border-t-2 border-dashed border-white/90 mix-blend-difference" />
      {centering?.leftRight && (
        <span className="absolute left-1/2 -translate-x-1/2 bottom-1.5 rounded-full bg-black/75 text-white text-[11px] font-semibold px-2 py-0.5 whitespace-nowrap">
          L/R {centering.leftRight}
        </span>
      )}
      {centering?.topBottom && (
        <span className="absolute top-1/2 -translate-y-1/2 left-1.5 rounded-full bg-black/75 text-white text-[11px] font-semibold px-2 py-0.5 whitespace-nowrap">
          T/B {centering.topBottom}
        </span>
      )}
    </div>
  );
}

function EdgeBands({ box, colour }) {
  if (!box) return null;
  const t = 'max(4px, 1.6%)';
  const style = { background: colour, opacity: 0.55 };
  return (
    <div className="absolute pointer-events-none" style={boxStyle(box)} data-overlay="edges">
      <div className="absolute inset-x-0 top-0" style={{ ...style, height: t }} />
      <div className="absolute inset-x-0 bottom-0" style={{ ...style, height: t }} />
      <div className="absolute inset-y-0 left-0" style={{ ...style, width: t }} />
      <div className="absolute inset-y-0 right-0" style={{ ...style, width: t }} />
    </div>
  );
}

function CornerMarks({ box, aspect, colour }) {
  const regions = cornerRegions(box, aspect);
  if (regions.length === 0) return null;
  const side = { tl: 'border-t-4 border-l-4 rounded-tl-lg', tr: 'border-t-4 border-r-4 rounded-tr-lg', bl: 'border-b-4 border-l-4 rounded-bl-lg', br: 'border-b-4 border-r-4 rounded-br-lg' };
  return regions.map((r) => (
    <div
      key={r.key}
      className={`absolute pointer-events-none ${side[r.key]}`}
      style={{ ...boxStyle(r), borderColor: colour }}
      data-overlay="corner"
    />
  ));
}

export default function GradeInspectionPhoto({
  src,
  alt,
  side,
  geometry,
  activeFactor = 'all',
  scores = {},
  selectedFinding = null,
  onSelectFinding,
}) {
  const [aspect, setAspect] = useState(2.5 / 3.5);
  const box = geometry?.cardLocation?.[side] ?? null;
  const centering = geometry?.centering?.[side] ?? null;
  const findings = (geometry?.findings ?? []).filter((f) => f.side === side);
  const shown = activeFactor === 'all' ? findings : findings.filter((f) => f.factor === activeFactor);
  const hasFactorFindings = shown.length > 0;
  const colour = SCORE_COLOURS[scores[activeFactor]] ?? SCORE_COLOURS.fair;

  return (
    <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-muted shadow-sm">
      <img
        src={src}
        alt={alt}
        className="block w-full h-auto select-none"
        draggable={false}
        onLoad={(e) => {
          const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
          if (w > 0 && h > 0) setAspect(w / h);
        }}
      />

      <div className="absolute inset-0">
        {/* The card's outline — dimmed when a specific factor is drawn on top of it */}
        {box && (
          <div
            className={`absolute pointer-events-none rounded-md border-2 border-dashed ${activeFactor === 'all' ? 'border-white/90' : 'border-white/50'}`}
            style={{ ...boxStyle(box), boxShadow: '0 0 0 1px rgba(0,0,0,0.35)' }}
            data-overlay="card"
          />
        )}

        {activeFactor === 'centering' && <CenteringGuides box={box} centering={centering} />}
        {activeFactor === 'edges' && !hasFactorFindings && <EdgeBands box={box} colour={colour} />}
        {activeFactor === 'corners' && !hasFactorFindings && <CornerMarks box={box} aspect={aspect} colour={colour} />}
        {activeFactor === 'surface' && !hasFactorFindings && box && (
          <div className="absolute pointer-events-none rounded-md" style={{ ...boxStyle(box), background: colour, opacity: 0.14 }} data-overlay="surface" />
        )}

        {shown.map((f) => {
          const sev = SEVERITY_STYLES[f.severity] ?? SEVERITY_STYLES.minor;
          const selected = selectedFinding === f.n;
          return (
            <button
              key={f.n}
              type="button"
              onClick={() => onSelectFinding?.(selected ? null : f.n)}
              className={`absolute rounded-md transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${selected ? 'z-10' : ''}`}
              style={{
                ...boxStyle(f),
                border: `${selected ? 3 : 2}px solid ${sev.ring}`,
                background: sev.fill,
                boxShadow: selected ? `0 0 0 3px rgba(255,255,255,0.85), 0 0 14px ${sev.ring}` : '0 0 0 1px rgba(0,0,0,0.35)',
              }}
              aria-label={`Finding ${f.n}: ${f.description || f.factor}`}
              aria-pressed={selected}
              data-finding={f.n}
            >
              <span
                className={`absolute ${f.x < 5 || f.y < 5 ? 'top-0.5 left-0.5' : '-top-2.5 -left-2.5'} flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white shadow`}
                style={{ background: sev.ring }}
              >
                {f.n}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
