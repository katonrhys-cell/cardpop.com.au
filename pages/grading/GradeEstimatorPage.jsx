import React, { useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Calculator, Upload, X, AlertTriangle, CheckCircle2, XCircle,
  ChevronRight, Info, Loader2, ArrowLeft, Star, Shield,
} from 'lucide-react';
import SEOHead from '@/components/SEOHead.jsx';
import { Button } from '@/components/ui/button';
import { useGradeEstimator } from '@/hooks/useGradeEstimator.js';
import { useAuth } from '@/contexts/AuthContext.jsx';

// ─── Grader config ────────────────────────────────────────────────────────────
const GRADERS = [
  {
    key: 'PSA',
    name: 'PSA',
    full: 'Professional Sports Authenticator',
    color: 'text-blue-600',
    bg: 'bg-blue-600',
    border: 'border-blue-600/30',
    light: 'bg-blue-50 dark:bg-blue-950/30',
  },
  {
    key: 'BGS',
    name: 'BGS',
    full: 'Beckett Grading Services',
    color: 'text-orange-500',
    bg: 'bg-orange-500',
    border: 'border-orange-500/30',
    light: 'bg-orange-50 dark:bg-orange-950/30',
  },
  {
    key: 'CGC',
    name: 'CGC',
    full: 'Certified Guaranty Company',
    color: 'text-violet-600',
    bg: 'bg-violet-600',
    border: 'border-violet-600/30',
    light: 'bg-violet-50 dark:bg-violet-950/30',
  },
  {
    key: 'ACE',
    name: 'ACE',
    full: 'ACE Grading (Australia)',
    color: 'text-red-500',
    bg: 'bg-red-500',
    border: 'border-red-500/30',
    light: 'bg-red-50 dark:bg-red-950/30',
  },
  {
    key: 'SGC',
    name: 'SGC',
    full: 'Sportscard Guaranty Corporation',
    color: 'text-slate-600',
    bg: 'bg-slate-600',
    border: 'border-slate-600/30',
    light: 'bg-slate-50 dark:bg-slate-950/30',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function gradeColor(estimate) {
  if (estimate >= 9.5) return 'text-emerald-500';
  if (estimate >= 8) return 'text-blue-500';
  if (estimate >= 6) return 'text-amber-500';
  if (estimate >= 4) return 'text-orange-500';
  return 'text-red-500';
}

function gradeBg(estimate) {
  if (estimate >= 9.5) return 'bg-emerald-500/10';
  if (estimate >= 8) return 'bg-blue-500/10';
  if (estimate >= 6) return 'bg-amber-500/10';
  if (estimate >= 4) return 'bg-orange-500/10';
  return 'bg-red-500/10';
}

function scoreIcon(score) {
  if (score === 'excellent') return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
  if (score === 'good') return <CheckCircle2 className="w-4 h-4 text-blue-500" />;
  if (score === 'fair') return <AlertTriangle className="w-4 h-4 text-amber-500" />;
  return <XCircle className="w-4 h-4 text-red-500" />;
}

function scoreBadge(score) {
  const map = {
    excellent: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    good: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
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

  const previewUrl = file ? URL.createObjectURL(file) : null;

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

function ConditionRow({ label, data }) {
  if (!data) return null;
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold capitalize">{label}</span>
        <div className="flex items-center gap-1.5">
          {scoreIcon(data.score)}
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${scoreBadge(data.score)}`}>
            {data.score}
          </span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{data.assessment}</p>
    </div>
  );
}

function GraderCard({ grader, gradeData }) {
  if (!gradeData) return null;
  const { estimate, range, label, confidence, notes, subGrades } = gradeData;

  return (
    <div className={`bg-card border ${grader.border} rounded-2xl overflow-hidden`}>
      <div className={`${grader.light} px-4 py-3 border-b ${grader.border}`}>
        <div className="flex items-center justify-between">
          <span className={`font-black text-lg tracking-tight ${grader.color}`}>{grader.name}</span>
          <span className="text-xs text-muted-foreground">{grader.full}</span>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className={`rounded-xl p-4 text-center ${gradeBg(estimate)}`}>
          <div className={`text-5xl font-black ${gradeColor(estimate)}`}>
            {estimate % 1 === 0 ? estimate.toFixed(0) : estimate.toFixed(1)}
          </div>
          <div className="text-sm font-semibold mt-1 text-foreground">{label}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Range: {range}</div>
        </div>

        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${confidenceDot(confidence)}`} />
          <span className="text-xs text-muted-foreground capitalize">
            {confidence} confidence
          </span>
        </div>

        {subGrades && (
          <div className="grid grid-cols-2 gap-1.5">
            {Object.entries(subGrades).map(([k, v]) => (
              <div key={k} className="bg-muted/50 rounded-lg px-2.5 py-1.5">
                <div className="text-xs text-muted-foreground capitalize">{k}</div>
                <div className={`text-sm font-bold ${gradeColor(v)}`}>
                  {v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}
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
      </div>
    </div>
  );
}

function ResultsView({ result, onReset }) {
  const { cardIdentification, conditionAnalysis, keyIssues, keyStrengths, overallCondition, grades, imageQualityNote } = result;

  return (
    <div className="space-y-8">
      {/* Card identification */}
      {(cardIdentification?.name || cardIdentification?.set) && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Star className="w-5 h-5 text-primary" />
            </div>
            <div>
              {cardIdentification.name && (
                <h3 className="font-bold text-lg">{cardIdentification.name}</h3>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                {cardIdentification.set && (
                  <span className="text-sm text-muted-foreground">{cardIdentification.set}</span>
                )}
                {cardIdentification.year && (
                  <span className="text-sm text-muted-foreground">{cardIdentification.year}</span>
                )}
                {cardIdentification.type && (
                  <span className="text-sm text-muted-foreground">{cardIdentification.type}</span>
                )}
              </div>
            </div>
            {overallCondition && (
              <span className="ml-auto text-sm font-semibold px-3 py-1 rounded-full bg-primary/10 text-primary whitespace-nowrap">
                {overallCondition}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Image quality note */}
      {imageQualityNote && (
        <div className="flex gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
          <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700 dark:text-amber-300">{imageQualityNote}</p>
        </div>
      )}

      {/* Condition breakdown */}
      {conditionAnalysis && (
        <section>
          <h3 className="text-lg font-bold mb-3">Condition Analysis</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ConditionRow label="Centering" data={conditionAnalysis.centering} />
            <ConditionRow label="Corners" data={conditionAnalysis.corners} />
            <ConditionRow label="Edges" data={conditionAnalysis.edges} />
            <ConditionRow label="Surface" data={conditionAnalysis.surface} />
          </div>
        </section>
      )}

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
          <h3 className="text-lg font-bold mb-1">Estimated Grades</h3>
          <p className="text-sm text-muted-foreground mb-4">
            AI-generated estimates only. Actual grades may differ. See disclaimer above.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
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
              BGS, CGC, ACE Grading, SGC, or any other grading company. Grade outcomes depend on physical
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
        description="Upload photos of your trading card and get AI-powered preliminary grade estimates across PSA, BGS, CGC, ACE, and SGC. A guide only — always consult a professional grader."
        keywords="card grade estimator, PSA grade estimate, trading card grading australia, BGS estimate, CGC grade, ACE grading australia, card condition checker"
      />

      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-charcoal via-gray-900 to-brand-charcoal py-20 text-center text-white">
        <div className="container-default">
          <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center mx-auto mb-6">
            <Calculator className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Grade Estimator</h1>
          <p className="text-lg text-white/80 max-w-2xl mx-auto">
            Upload photos of your trading card and receive AI-generated preliminary grade estimates
            across five major grading services. A guide to help you self-assess before professional submission.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 bg-white/15 border border-white/25 rounded-full px-4 py-2 text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-300" />
            <span>Estimate only — not professional grading advice</span>
          </div>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">

        {result ? (
          <ResultsView result={result} onReset={handleReset} />
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
                  { step: '3', title: 'Review Estimates', body: 'Receive preliminary grade estimates across PSA, BGS, CGC, ACE, and SGC alongside a condition breakdown.' },
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
                  <div key={g.key} className={`bg-card border ${g.border} rounded-xl px-4 py-3 flex items-center gap-3`}>
                    <div className={`w-8 h-8 rounded-lg ${g.bg} flex items-center justify-center text-white text-xs font-black`}>
                      {g.key}
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{g.name}</div>
                      <div className="text-xs text-muted-foreground">{g.full}</div>
                    </div>
                  </div>
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
