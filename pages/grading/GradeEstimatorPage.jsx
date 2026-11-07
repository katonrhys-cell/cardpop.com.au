import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Calculator, Upload, X, AlertTriangle, CheckCircle2, XCircle,
  ChevronRight, Info, Loader2, ArrowLeft, Star, Shield, ScanSearch,
} from 'lucide-react';
import SEOHead from '@/components/SEOHead.jsx';
import { Button } from '@/components/ui/button';
import { useGradeEstimator } from '@/hooks/useGradeEstimator.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import GraderLogo from '@/components/grading/GraderLogo.jsx';
import SlabLabel from '@/components/grading/SlabLabel.jsx';
import { GRADING_COMPANIES, graderStyle } from '@/data/gradingCompanies.js';
import { gradingPartnersPath } from '@/utils/gradingPartners.js';
import { normaliseGradeGeometry, GRADE_FACTORS } from '@/utils/gradeFindings.js';
import GradeInspectionPhoto, { SEVERITY_STYLES } from '@/components/grading/GradeInspectionPhoto.jsx';

// ─── Grader config ────────────────────────────────────────────────────────────
// Names, official logos and brand colours live in data/gradingCompanies.js (shared with the
// rest of the Grading Hub); the results grid renders whatever keys the prompt returns that
// this list carries.
const GRADERS = GRADING_COMPANIES;

// ─── Helpers ──────────────────────────────────────────────────────────────────
// AI model JSON isn't guaranteed to return a number (a string like "9.5", or a
// missing/null field, is possible) — .toFixed() throws on either (strings have
// no toFixed, null/undefined can't be called at all), white-screening the page.
function formatGrade(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n % 1 === 0 ? n.toFixed(0) : n.toFixed(1);
}

function gradeColor(estimate) {
  if (estimate >= 9.5) return 'text-emerald-500';
  if (estimate >= 8) return 'text-green-600 dark:text-green-400';
  if (estimate >= 6) return 'text-amber-500';
  if (estimate >= 4) return 'text-orange-500';
  return 'text-red-500';
}

function scoreIcon(score) {
  if (score === 'excellent') return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
  if (score === 'good') return <CheckCircle2 className="w-4 h-4 text-green-500" />;
  if (score === 'fair') return <AlertTriangle className="w-4 h-4 text-amber-500" />;
  return <XCircle className="w-4 h-4 text-red-500" />;
}

function scoreBadge(score) {
  const map = {
    excellent: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    good: 'bg-green-500/10 text-green-700 dark:text-green-400',
    fair: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    poor: 'bg-red-500/10 text-red-600 dark:text-red-400',
  };
  return map[score] || map.fair;
}

function confidenceDot(confidence) {
  if (confidence === 'high') return 'bg-emerald-500';
  if (confidence === 'medium') return 'bg-amber-500';
  return 'bg-orange-500';
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function DisclaimerBanner() {
  return (
    <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-2xl p-5">
      <div className="flex gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-bold text-amber-800 dark:text-amber-300 mb-1">
            Preliminary Estimate Only — Not Professional Grading Advice
          </p>
          <p className="text-amber-700 dark:text-amber-400 leading-relaxed">
            This tool provides AI-generated grade estimates as a preliminary guide only. CardPop Australia
            accepts no liability for actual grades returned by any grading company. Results may vary
            significantly from professional grades. Always conduct a thorough physical examination of your card
            and consult a qualified grading professional before submitting. By using this tool you acknowledge
            that CardPop Australia is not responsible for any financial loss or grade outcomes. This is a
            free guide to assist with your preliminary self-assessment only.
          </p>
        </div>
      </div>
    </div>
  );
}

function ImageUploadSlot({ label, required, file, onFile, onRemove }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.type.startsWith('image/')) onFile(dropped);
  }, [onFile]);

  // Create the object URL in an effect (not in render) so it's created once per
  // file and revoked on change/unmount — building it inline leaked a new blob
  // URL (holding the full image) on every re-render.
  const [previewUrl, setPreviewUrl] = useState(null);
  useEffect(() => {
    if (!file) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold text-foreground">
        {label} {required && <span className="text-red-500">*</span>}
        {!required && <span className="text-muted-foreground font-normal ml-1">(recommended)</span>}
      </label>

      {file ? (
        <div className="relative rounded-2xl overflow-hidden border-2 border-primary/40 aspect-[2.5/3.5] bg-muted">
          <img src={previewUrl} alt={label} className="w-full h-full object-contain" />
          <button
            type="button"
            onClick={onRemove}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-background/90 border border-border flex items-center justify-center hover:bg-destructive hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`aspect-[2.5/3.5] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-all cursor-pointer
            ${dragging
              ? 'border-primary bg-primary/10'
              : 'border-border hover:border-primary/60 hover:bg-primary/5'}`}
        >
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Upload className="w-6 h-6 text-primary" />
          </div>
          <div className="text-center px-4">
            <p className="text-sm font-medium">Drop image here</p>
            <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
            <p className="text-xs text-muted-foreground">JPG, PNG, WebP — max 10 MB</p>
          </div>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }}
      />
    </div>
  );
}

// A blob: URL for a File, revoked when the file changes or the view unmounts.
function useObjectUrl(file) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!file) { setUrl(null); return undefined; }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

const FACTOR_LABELS = { centering: 'Centering', corners: 'Corners', edges: 'Edges', surface: 'Surface' };

/** One line per company: the at-a-glance answer, before the detail below. */
function GradeSummaryTable({ grades }) {
  const rows = GRADERS.filter((g) => grades?.[g.key]);
  if (rows.length === 0) return null;
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden" data-testid="grade-summary">
      <table className="w-full text-sm">
        <caption className="sr-only">Estimated grade by grading company</caption>
        <thead className="bg-muted/60 text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th scope="col" className="text-left font-semibold px-3 sm:px-4 py-2">Company</th>
            <th scope="col" className="text-left font-semibold px-2 py-2">Estimate</th>
            <th scope="col" className="text-left font-semibold px-2 py-2">Range</th>
            <th scope="col" className="text-left font-semibold px-3 sm:px-4 py-2">Confidence</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((g) => {
            const d = grades[g.key];
            return (
              <tr key={g.key} style={graderStyle(g)}>
                <th scope="row" className="text-left font-normal px-3 sm:px-4 py-2.5">
                  <a
                    href={`#grader-${g.key}`}
                    onClick={(e) => {
                      const el = document.getElementById(`grader-${g.key}`);
                      if (el) { e.preventDefault(); el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
                    }}
                    className="inline-flex items-center gap-2 min-w-0"
                    title={g.full}
                  >
                    <GraderLogo grader={g} height={18} wordmarkClassName="text-sm" />
                    <span className="sr-only">{g.name}</span>
                  </a>
                </th>
                <td className="px-2 py-2.5">
                  <div className={`text-lg font-black tabular-nums leading-none ${gradeColor(Number(d.estimate))}`}>
                    {formatGrade(d.estimate)}
                  </div>
                  {d.label && <div className="text-[11px] text-muted-foreground leading-tight mt-0.5 line-clamp-2">{d.label}</div>}
                </td>
                <td className="px-2 py-2.5 tabular-nums text-muted-foreground whitespace-nowrap">{d.range || '—'}</td>
                <td className="px-3 sm:px-4 py-2.5">
                  <span className="inline-flex items-center gap-1.5 text-xs capitalize text-muted-foreground">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${confidenceDot(d.confidence)}`} />
                    {d.confidence || '—'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The member's photo with what the estimate is talking about drawn on it, and the
 * four condition factors as tabs underneath: choosing one highlights that part of
 * the card and lists the numbered findings that belong to it.
 */
function InspectionPanel({ conditionAnalysis, geometry, photos, imageQualityNote }) {
  const frontUrl = useObjectUrl(photos?.front);
  const backUrl = useObjectUrl(photos?.back);
  const [side, setSide] = useState('front');
  const [factor, setFactor] = useState('all');
  const [selected, setSelected] = useState(null);
  const photoRef = useRef(null);

  const scores = useMemo(() => Object.fromEntries(
    GRADE_FACTORS.map((k) => [k, conditionAnalysis?.[k]?.score]),
  ), [conditionAnalysis]);

  const findings = geometry.findings;
  const listed = factor === 'all' ? findings : findings.filter((f) => f.factor === factor);
  const url = side === 'back' ? backUrl : frontUrl;
  const centering = geometry.centering[side];

  const chooseFactor = (key) => {
    setFactor(key);
    setSelected(null);
    // Jump to the side the factor's findings are on, if none are on this one.
    const onSide = findings.filter((f) => key === 'all' || f.factor === key);
    if (onSide.length > 0 && !onSide.some((f) => f.side === side)) setSide(onSide[0].side);
  };

  const chooseFinding = (n) => {
    setSelected(n);
    const f = findings.find((x) => x.n === n);
    if (f && f.side !== side) setSide(f.side);
    if (f && typeof window !== 'undefined' && window.matchMedia?.('(max-width: 1023px)').matches) {
      photoRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    }
  };

  if (!frontUrl && !conditionAnalysis) return null;

  const active = factor === 'all' ? null : conditionAnalysis?.[factor];

  return (
    <section aria-labelledby="inspection-heading">
      <h3 id="inspection-heading" className="text-lg font-bold mb-1 flex items-center gap-2">
        <ScanSearch className="w-5 h-5 text-primary" /> Condition Inspection
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Tap a factor to see where on your card it was judged. Numbered boxes mark specific spots.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] gap-5 lg:gap-8 items-start">
        {/* Photo */}
        <div ref={photoRef} className="lg:sticky lg:top-24 space-y-3">
          {backUrl && (
            <div className="mx-auto flex w-full max-w-sm rounded-xl bg-muted p-1" role="tablist" aria-label="Photo side">
              {['front', 'back'].map((s) => (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  aria-selected={side === s}
                  onClick={() => { setSide(s); setSelected(null); }}
                  className={`flex-1 rounded-lg py-1.5 text-sm font-semibold capitalize transition-colors ${side === s ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {s}
                  {findings.some((f) => f.side === s) && (
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">({findings.filter((f) => f.side === s).length})</span>
                  )}
                </button>
              ))}
            </div>
          )}
          {url && (
            <GradeInspectionPhoto
              src={url}
              alt={`Your card ${side}`}
              side={side}
              geometry={geometry}
              activeFactor={factor}
              scores={scores}
              selectedFinding={selected}
              onSelectFinding={chooseFinding}
            />
          )}
          {/* On a phone the list is below the fold — echo the tapped spot under the photo */}
          {(() => {
            const f = findings.find((x) => x.n === selected);
            if (!f) return null;
            const sev = SEVERITY_STYLES[f.severity] ?? SEVERITY_STYLES.minor;
            return (
              <div className="mx-auto max-w-sm flex gap-2.5 items-start rounded-xl border border-border bg-card px-3 py-2" aria-live="polite" data-testid="selected-finding">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white mt-0.5" style={{ background: sev.ring }}>{f.n}</span>
                <span className="text-sm leading-snug">
                  {f.description || FACTOR_LABELS[f.factor]}
                  <span className="block text-[11px] text-muted-foreground capitalize">{FACTOR_LABELS[f.factor]} · {sev.label}</span>
                </span>
              </div>
            );
          })()}
          {centering && (
            <p className="text-center text-xs text-muted-foreground">
              Estimated {side} centering:{' '}
              {centering.leftRight && <span className="font-semibold text-foreground">L/R {centering.leftRight}</span>}
              {centering.leftRight && centering.topBottom && ' · '}
              {centering.topBottom && <span className="font-semibold text-foreground">T/B {centering.topBottom}</span>}
            </p>
          )}
          {imageQualityNote && (
            <div className="flex gap-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 max-w-sm mx-auto">
              <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">{imageQualityNote}</p>
            </div>
          )}
        </div>

        {/* Factors + findings */}
        <div className="min-w-0 space-y-4">
          {conditionAnalysis && (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-2" role="tablist" aria-label="Condition factor">
              {GRADE_FACTORS.map((key) => {
                const data = conditionAnalysis[key];
                if (!data) return null;
                const on = factor === key;
                const count = findings.filter((f) => f.factor === key).length;
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => chooseFactor(on ? 'all' : key)}
                    className={`text-left rounded-xl border px-3 py-2.5 transition-colors ${on ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card hover:border-primary/50'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold">{FACTOR_LABELS[key]}</span>
                      {scoreIcon(data.score)}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${scoreBadge(data.score)}`}>{data.score || '—'}</span>
                      {count > 0 && <span className="text-[11px] text-muted-foreground">{count} spot{count === 1 ? '' : 's'}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {active ? (
            <div className="bg-card border border-border rounded-xl p-4">
              <h4 className="text-sm font-bold mb-1.5">{FACTOR_LABELS[factor]}</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{active.assessment}</p>
            </div>
          ) : conditionAnalysis && (
            <p className="text-sm text-muted-foreground">
              Showing every marked spot. Choose a factor above for its full assessment.
            </p>
          )}

          {listed.length > 0 ? (
            <ol className="space-y-2" aria-label="Marked spots">
              {listed.map((f) => {
                const sev = SEVERITY_STYLES[f.severity] ?? SEVERITY_STYLES.minor;
                const on = selected === f.n;
                return (
                  <li key={f.n}>
                    <button
                      type="button"
                      onClick={() => chooseFinding(on ? null : f.n)}
                      aria-pressed={on}
                      className={`w-full text-left flex gap-3 items-start rounded-xl border px-3 py-2.5 transition-colors ${on ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/50'}`}
                    >
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: sev.ring }}>
                        {f.n}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-foreground leading-snug">{f.description || FACTOR_LABELS[f.factor]}</span>
                        <span className="block text-[11px] text-muted-foreground mt-0.5 capitalize">
                          {FACTOR_LABELS[f.factor]} · {f.side} · {sev.label}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          ) : (factor !== 'all' || findings.length === 0) && (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-xl px-3 py-2.5">
              {factor === 'all'
                ? 'No specific flaws were pinpointed in the photos.'
                : `No specific ${FACTOR_LABELS[factor].toLowerCase()} flaws were pinpointed — the highlighted area shows what was assessed.`}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function GraderCard({ grader, gradeData }) {
  if (!gradeData) return null;
  const { estimate, range, label, confidence, notes, subGrades } = gradeData;

  return (
    <div
      id={`grader-${grader.key}`}
      className="bg-card border border-[var(--grader-border)] dark:border-[var(--grader-border-dark)] rounded-2xl overflow-hidden scroll-mt-24"
      style={graderStyle(grader)}
    >
      <div className="bg-[var(--grader-tint)] dark:bg-[var(--grader-tint-dark)] px-4 py-3 border-b border-[var(--grader-border)] dark:border-[var(--grader-border-dark)]">
        <div className="flex items-center justify-between gap-3">
          <GraderLogo grader={grader} height={24} wordmarkClassName="text-lg" />
          <span className="text-xs text-muted-foreground text-right">{grader.full}</span>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* The estimate drawn as the label on that company's slab */}
        <SlabLabel grader={grader} estimate={estimate} label={label} range={range} subGrades={subGrades} />

        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${confidenceDot(confidence)}`} />
          <span className="text-xs text-muted-foreground capitalize">
            {confidence} confidence
          </span>
        </div>

        {subGrades && !grader.label?.showSubGrades && (
          <div className="grid grid-cols-2 gap-1.5">
            {Object.entries(subGrades).map(([k, v]) => (
              <div key={k} className="bg-muted/50 rounded-lg px-2.5 py-1.5">
                <div className="text-xs text-muted-foreground capitalize">{k}</div>
                <div className={`text-sm font-bold ${gradeColor(v)}`}>
                  {formatGrade(v)}
                </div>
              </div>
            ))}
          </div>
        )}

        {notes && (
          <p className="text-xs text-muted-foreground leading-relaxed border-t border-border pt-3">
            {notes}
          </p>
        )}

        {/* → the Australian stores and services that submit to this company */}
        <Button asChild variant="outline" size="sm" className="w-full border-[var(--grader-border)] dark:border-[var(--grader-border-dark)] hover:bg-[var(--grader-tint)] dark:hover:bg-[var(--grader-tint-dark)]">
          <Link to={gradingPartnersPath(grader.key)} data-grade-with={grader.key}>
            Grade with {grader.name} <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function ResultsView({ result, photos, onReset }) {
  const { cardIdentification, conditionAnalysis, keyIssues, keyStrengths, overallCondition, grades, imageQualityNote } = result;
  const geometry = useMemo(
    () => normaliseGradeGeometry(result, { hasBack: Boolean(photos?.back) }),
    [result, photos?.back],
  );
  const idRows = [
    ['Set', cardIdentification?.set],
    ['Year', cardIdentification?.year],
    ['Type', cardIdentification?.type],
  ].filter(([, v]) => v);

  return (
    <div className="space-y-8">
      {/* Card identification */}
      {(cardIdentification?.name || idRows.length > 0 || overallCondition) && (
        <div className="bg-card border border-border rounded-2xl p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Star className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Grade estimate for</p>
              <h3 className="font-bold text-lg leading-snug break-words">
                {cardIdentification?.name || 'Your card'}
              </h3>
            </div>
          </div>
          {idRows.length > 0 && (
            <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
              {idRows.map(([k, v]) => (
                <React.Fragment key={k}>
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-foreground break-words">{v}</dd>
                </React.Fragment>
              ))}
            </dl>
          )}
          {overallCondition && (
            <p className="mt-3 text-sm rounded-xl bg-primary/5 border border-primary/15 px-3 py-2 text-foreground break-words">
              <span className="font-semibold text-primary">Overall: </span>{overallCondition}
            </p>
          )}
        </div>
      )}

      {/* Every company at a glance */}
      {grades && (
        <section aria-labelledby="summary-heading">
          <h3 id="summary-heading" className="text-lg font-bold mb-3">Grades at a Glance</h3>
          <GradeSummaryTable grades={grades} />
          <p className="text-xs text-muted-foreground mt-2">
            AI-generated estimates only — actual grades may differ. Tap a company for its full label and notes.
          </p>
        </section>
      )}

      {/* The photo, with what was judged drawn on it */}
      <InspectionPanel
        conditionAnalysis={conditionAnalysis}
        geometry={geometry}
        photos={photos}
        imageQualityNote={imageQualityNote}
      />

      {/* Strengths & issues */}
      {((keyStrengths?.length > 0) || (keyIssues?.length > 0)) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {keyStrengths?.length > 0 && (
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4">
              <h4 className="font-bold text-emerald-700 dark:text-emerald-400 mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Key Strengths
              </h4>
              <ul className="space-y-2">
                {keyStrengths.map((s, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex gap-2">
                    <ChevronRight className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {keyIssues?.length > 0 && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4">
              <h4 className="font-bold text-red-700 dark:text-red-400 mb-3 flex items-center gap-2">
                <XCircle className="w-4 h-4" /> Key Issues
              </h4>
              <ul className="space-y-2">
                {keyIssues.map((s, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex gap-2">
                    <ChevronRight className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Grade estimates */}
      {grades && (
        <section>
          <h3 className="text-lg font-bold mb-1">Estimated Grades by Company</h3>
          <p className="text-sm text-muted-foreground mb-4">
            AI-generated estimates only. Actual grades may differ. See disclaimer above.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {GRADERS.map((grader) => (
              <GraderCard key={grader.key} grader={grader} gradeData={grades[grader.key]} />
            ))}
          </div>
        </section>
      )}

      {/* Bottom disclaimer */}
      <div className="bg-muted/50 border border-border rounded-2xl p-5">
        <div className="flex gap-3">
          <Shield className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground leading-relaxed space-y-2">
            <p>
              <strong className="text-foreground">CardPop Australia Grade Estimator — Disclaimer:</strong> These
              estimates are generated by AI analysis of uploaded images and are provided for informational and
              preliminary self-assessment purposes only. They do not constitute professional grading advice.
            </p>
            <p>
              CardPop Australia Pty Ltd accepts no responsibility or liability for actual grades returned by PSA,
              BGS, CGC, ACE Grading, SGC, TAG, or any other grading company. Grade outcomes depend on physical
              examination, proprietary standards, and grader discretion that cannot be replicated by image
              analysis alone.
            </p>
            <p>
              You acknowledge that by using this tool you agree to CardPop's{' '}
              <Link to="/terms" className="underline hover:text-foreground">Terms of Service</Link>.
              Always seek professional assessment before making financial decisions based on any card's
              anticipated grade. CardPop Australia is not liable for any financial loss resulting from reliance
              on these estimates.
            </p>
          </div>
        </div>
      </div>

      <Button variant="outline" onClick={onReset} className="w-full">
        <ArrowLeft className="w-4 h-4 mr-2" /> Analyse Another Card
      </Button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
const GradeEstimatorPage = () => {
  const { isAuthenticated } = useAuth();
  const { estimateGrade, isAnalysing, result, error, reset } = useGradeEstimator();
  const [frontImage, setFrontImage] = useState(null);
  const [backImage, setBackImage] = useState(null);

  const handleSubmit = async () => {
    const images = [frontImage, backImage].filter(Boolean);
    await estimateGrade(images);
  };

  const handleReset = () => {
    reset();
    setFrontImage(null);
    setBackImage(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Card Grade Estimator | CardPop — AI Grading Guide for Australian Collectors"
        description="Upload photos of your trading card and get AI-powered preliminary grade estimates across PSA, BGS, CGC, ACE, SGC and TAG. A guide only — always consult a professional grader."
        keywords="card grade estimator, PSA grade estimate, trading card grading australia, BGS estimate, CGC grade, ACE grading australia, SGC grade, TAG grading, card condition checker"
      />

      {/* Hero */}
      <section className="bg-card border-b border-border py-20 text-center">
        <div className="container-default">
          <Calculator className="w-12 h-12 text-primary mx-auto mb-6" />
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Grade Estimator</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Upload photos of your trading card and receive AI-generated preliminary grade estimates
            across six major grading services. A guide to help you self-assess before professional submission.
          </p>
        </div>
      </section>

      <div className="container-default py-10 space-y-8">

        {result ? (
          <ResultsView result={result} photos={{ front: frontImage, back: backImage }} onReset={handleReset} />
        ) : (
          <>
            <DisclaimerBanner />

            {/* Login gate */}
            {!isAuthenticated ? (
              <div className="bg-card border border-border rounded-3xl p-10 text-center">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
                  <Calculator className="w-7 h-7 text-primary" />
                </div>
                <h2 className="text-2xl font-bold mb-3">Sign in to Use the Grade Estimator</h2>
                <p className="text-muted-foreground max-w-sm mx-auto mb-7 leading-relaxed">
                  Create a free CardPop account to access the AI grade estimator and other grading tools.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button asChild size="lg" className="px-8">
                    <Link to="/signup">Create Free Account</Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="px-8">
                    <Link to="/login">Sign In</Link>
                  </Button>
                </div>
              </div>
            ) : (
              /* Upload interface */
              <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 space-y-6">
                <div>
                  <h2 className="text-xl font-bold mb-1">Upload Card Photos</h2>
                  <p className="text-sm text-muted-foreground">
                    For the most accurate estimate, upload both a front and back photo. Clear, well-lit images
                    taken on a flat surface produce the best results.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto sm:max-w-md">
                  <ImageUploadSlot
                    label="Card Front"
                    required
                    file={frontImage}
                    onFile={setFrontImage}
                    onRemove={() => setFrontImage(null)}
                  />
                  <ImageUploadSlot
                    label="Card Back"
                    required={false}
                    file={backImage}
                    onFile={setBackImage}
                    onRemove={() => setBackImage(null)}
                  />
                </div>

                <div className="bg-muted/50 rounded-xl p-4 text-xs text-muted-foreground space-y-1">
                  <p className="font-semibold text-foreground text-sm mb-2">Tips for better estimates</p>
                  <p>• Photograph in bright, natural light with no flash glare</p>
                  <p>• Lay the card flat on a neutral background</p>
                  <p>• Include all four corners and edges in frame</p>
                  <p>• Take close-up shots to capture surface detail</p>
                </div>

                {error && (
                  <div className="flex gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                    <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-semibold text-red-700 dark:text-red-400">Analysis failed</p>
                      <p className="text-muted-foreground mt-0.5">{error}</p>
                    </div>
                  </div>
                )}

                <Button
                  size="lg"
                  disabled={!frontImage || isAnalysing}
                  onClick={handleSubmit}
                  className="w-full disabled:opacity-50"
                >
                  {isAnalysing ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Analysing card…
                    </>
                  ) : (
                    <>
                      <Calculator className="w-5 h-5 mr-2" />
                      Estimate Grades
                    </>
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  By clicking Estimate Grades you confirm you have read and agree to the disclaimer above.
                </p>
              </div>
            )}

            {/* How it works */}
            <section>
              <h2 className="text-xl font-bold mb-4">How It Works</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { step: '1', title: 'Upload Photos', body: 'Upload clear photos of your card front and optionally the back for a more complete assessment.' },
                  { step: '2', title: 'AI Analysis', body: 'Our AI examines centering, corners, edges, and surface condition against grading standards for each company.' },
                  { step: '3', title: 'Review Estimates', body: 'Receive preliminary grade estimates across PSA, BGS, CGC, ACE, SGC and TAG alongside a condition breakdown.' },
                ].map(({ step, title, body }) => (
                  <div key={step} className="bg-card border border-border rounded-2xl p-5">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                      <span className="text-primary font-black text-sm">{step}</span>
                    </div>
                    <h3 className="font-bold mb-2">{title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Graders reference */}
            <section>
              <h2 className="text-xl font-bold mb-4">Grading Services Covered</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {GRADERS.map((g) => (
                  <Link
                    key={g.key}
                    to={gradingPartnersPath(g.key)}
                    className="bg-card border border-[var(--grader-border)] dark:border-[var(--grader-border-dark)] rounded-xl px-4 py-3 flex items-center gap-3 hover:bg-[var(--grader-tint)] dark:hover:bg-[var(--grader-tint-dark)] transition-colors group"
                    style={graderStyle(g)}
                    title={`Australian stores that submit to ${g.name}`}
                  >
                    <div className="h-10 min-w-[2.5rem] px-2 rounded-lg bg-[var(--grader-tint)] dark:bg-[var(--grader-tint-dark)] flex items-center justify-center">
                      <GraderLogo grader={g} height={22} wordmarkClassName="text-xs" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm">{g.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{g.full}</div>
                      <div className="text-xs text-primary group-hover:underline">Grade with {g.name} →</div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            {/* Links to grading resources */}
            <section className="bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border border-primary/20 rounded-3xl p-8 text-center">
              <h2 className="text-xl font-bold mb-2">Learn More About Card Grading</h2>
              <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
                Understanding grading standards helps you self-assess more accurately before using this tool.
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Button asChild variant="outline" size="sm">
                  <Link to="/grading/scales">
                    <ChevronRight className="w-4 h-4 mr-1" /> Grading Scales
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/grading/companies">
                    <ChevronRight className="w-4 h-4 mr-1" /> Compare Companies
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/grading/local">
                    <ChevronRight className="w-4 h-4 mr-1" /> Local Graders (AU)
                  </Link>
                </Button>
              </div>
            </section>
          </>
        )}

      </div>
    </div>
  );
};

export default GradeEstimatorPage;
