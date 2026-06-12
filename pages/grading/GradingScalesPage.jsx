import React from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { Link } from 'react-router-dom';
import { BarChart2, ArrowLeft, ChevronRight } from 'lucide-react';

const SCALES = [
  { grade: '10', label: 'Gem Mint',            condition: 'Perfect in every way — virtually no flaws under magnification. Centering 55/45 or better front, 75/25 back.' },
  { grade: '9',  label: 'Mint',                condition: 'One minor flaw allowed — a slight print spot or surface scratch; otherwise perfect centering and edges.' },
  { grade: '8',  label: 'Near Mint–Mint',      condition: 'Up to two minor flaws visible. Slight imperfection on corners or surface; no creases.' },
  { grade: '7',  label: 'Near Mint',           condition: 'Small flaws on corners or edges. Surface may show minor scratches or light print lines. No creases.' },
  { grade: '6',  label: 'Excellent–Mint',      condition: 'Light wear overall. May have minor corner or edge issues. Surface shows slight loss of gloss.' },
  { grade: '5',  label: 'Excellent',           condition: 'Obvious signs of wear on corners. Moderate scratching on surface. Centering may be noticeably off.' },
  { grade: '4',  label: 'Very Good–Excellent', condition: 'Some rounding of corners and/or edges. Light creasing possible. Surface shows definite wear.' },
  { grade: '3',  label: 'Very Good',           condition: 'Significant creasing, rounding of corners, and surface wear. Card retains its original shape.' },
  { grade: '2',  label: 'Good',                condition: 'Heavy wear throughout. Major creases, scratches, or stains. May have writing or minor tears.' },
  { grade: '1',  label: 'Poor',                condition: 'Heavily damaged. Significant defects including major creases, tears, or tape on both surfaces.' },
];

const gradeColor = (g) => {
  const n = parseInt(g);
  if (n >= 9) return 'text-emerald-500';
  if (n >= 7) return 'text-blue-500';
  if (n >= 5) return 'text-amber-500';
  return 'text-destructive';
};

const GradingScalesPage = () => (
  <div className="min-h-screen bg-background">
    <SEOHead title="Trading Card Grading Scales 1–10 | CardPop Grading Hub" description="Understand the PSA, BGS and ACE trading card grading scales from 1 to 10. Learn exactly what each grade means and how condition affects your card's resale value in Australia." />

    <section className="bg-card border-b border-border py-20 text-center">
      <div className="container-default">
        <BarChart2 className="w-12 h-12 text-primary mx-auto mb-6" />
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Grading Scales</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          The complete 1–10 condition scale used by major authenticators.
          Understand exactly what separates a Mint 9 from a Gem Mint 10.
        </p>
      </div>
    </section>

    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">

      <Link to="/grading" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Grading Hub
      </Link>

      {/* Scale table */}
      <div className="bg-card border border-border rounded-3xl overflow-hidden">
        <div className="grid grid-cols-[56px_160px_1fr] text-xs font-semibold uppercase tracking-widest text-muted-foreground bg-muted/50 px-6 py-3 border-b border-border">
          <span>Grade</span>
          <span>Label</span>
          <span>Condition</span>
        </div>
        {SCALES.map(({ grade, label, condition }, i) => (
          <div
            key={grade}
            className={`grid grid-cols-[56px_160px_1fr] gap-2 px-6 py-5 items-start hover:bg-muted/20 transition-colors ${i < SCALES.length - 1 ? 'border-b border-border/60' : ''}`}
          >
            <span className={`font-black text-2xl leading-none ${gradeColor(grade)}`}>{grade}</span>
            <span className="font-semibold text-sm pt-0.5">{label}</span>
            <span className="text-sm text-muted-foreground leading-relaxed">{condition}</span>
          </div>
        ))}
      </div>

      {/* Tips */}
      <div>
        <h2 className="text-2xl font-bold mb-5">Tips for Maximising Your Grade</h2>
        <div className="space-y-3">
          {[
            { tip: 'Handle cards by the edges only', detail: 'Fingerprints and oils from your skin cause surface damage that\'s visible to graders.' },
            { tip: 'Use penny sleeves immediately after pulling', detail: 'Even a brand-new pack-fresh card can pick up micro-scratches from a binder or box.' },
            { tip: 'Store vertically in a hard case', detail: 'Avoid pressure or bending. Horizontal stacking can cause edge and corner wear over time.' },
            { tip: 'Check centering before submitting', detail: 'Centering is the most common reason PSA 10s become PSA 9s. Use a ruler or centering tool.' },
            { tip: 'Clean only with a soft microfibre cloth', detail: 'Never use paper towels or tissues — they leave micro-scratches on the surface.' },
          ].map(({ tip, detail }) => (
            <div key={tip} className="bg-card border border-border rounded-2xl px-6 py-5">
              <p className="font-semibold mb-1">{tip}</p>
              <p className="text-sm text-muted-foreground">{detail}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Next */}
      <Link to="/grading/companies" className="bg-card border border-border rounded-2xl p-6 hover:border-primary/50 hover:shadow-md transition-all group flex items-center justify-between">
        <div>
          <p className="font-bold group-hover:text-primary transition-colors">Compare Grading Companies</p>
          <p className="text-sm text-muted-foreground mt-0.5">See how PSA, BGS, CGC and ACE apply these scales</p>
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
      </Link>

    </div>
  </div>
);

export default GradingScalesPage;
