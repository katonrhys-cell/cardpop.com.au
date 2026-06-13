import React from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { Link } from 'react-router-dom';
import { BarChart2, ArrowLeft, ArrowRight, ChevronRight } from 'lucide-react';

const COMPANIES = [
  { slug: 'psa', name: 'PSA', full: 'Professional Sports Authenticator', note: '1–10 Scale' },
  { slug: 'bgs', name: 'BGS', full: 'Beckett Grading Services', note: '1–10 Scale with Subgrades' },
  { slug: 'cgc', name: 'CGC', full: 'Certified Guaranty Company', note: '1–10 Scale' },
  { slug: 'ace', name: 'ACE', full: 'ACE Grading', note: '1–10 Scale with Custom Labels' },
];

const UNIVERSAL_SCALE = [
  { grade: '10',  label: 'Gem Mint / Pristine',  condition: 'Virtually flawless. Perfect or near-perfect centering. Sharp focus, clean edges, and completely intact corners under magnification.' },
  { grade: '9',   label: 'Mint',                  condition: 'A superb condition card exhibiting only one very minor flaw, such as a slight printing imperfection or very slightly off-white borders.' },
  { grade: '8',   label: 'Near Mint – Mint',       condition: 'A high-end card that appears Mint at first glance but reveals minor flaws upon close inspection, like slight corner wear or minor centering issues.' },
  { grade: '7',   label: 'Near Mint',              condition: 'Shows slight surface wear or a minor printing defect. Corners may have slight fraying, but image focus remains sharp.' },
  { grade: '5–6', label: 'Excellent to EX-MT',     condition: 'Visible surface wear, minor scratching, or loss of original gloss. Edges and corners show clear but moderate wear.' },
  { grade: '1–4', label: 'Poor to Very Good',       condition: 'Heavily handled. Features creasing, severe corner wear, scuffing, staining, or other major defects. The card\'s core image is still visible.' },
];

const TIPS = [
  { tip: 'Handle cards by the edges only', detail: 'Fingerprints and oils from your skin cause surface damage that\'s visible to graders.' },
  { tip: 'Use penny sleeves immediately after pulling', detail: 'Even a brand-new pack-fresh card can pick up micro-scratches from a binder or box.' },
  { tip: 'Store vertically in a hard case', detail: 'Avoid pressure or bending. Horizontal stacking can cause edge and corner wear over time.' },
  { tip: 'Check centering before submitting', detail: 'Centering is the most common reason PSA 10s become PSA 9s. Use a ruler or centering tool.' },
  { tip: 'Clean only with a soft microfibre cloth', detail: 'Never use paper towels or tissues — they leave micro-scratches on the surface.' },
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
    <SEOHead
      title="Trading Card Grading Scales 1–10 | CardPop Grading Hub"
      description="Understand the PSA, BGS, CGC and ACE trading card grading scales from 1 to 10. Learn exactly what each grade means and how condition affects your card's resale value in Australia."
    />

    <section className="bg-card border-b border-border py-20 text-center">
      <div className="container-default">
        <BarChart2 className="w-12 h-12 text-primary mx-auto mb-6" />
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Grading Scales</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          While most authenticators use a 1 to 10 scale, the exact definitions and
          tolerances for a "Gem Mint" card differ slightly between companies.
        </p>
      </div>
    </section>

    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">

      <Link to="/grading" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Grading Hub
      </Link>

      {/* Company quick-links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {COMPANIES.map(({ slug, name, full, note }) => (
          <Link
            key={slug}
            to={`/grading/scales/${slug}`}
            className="bg-card border border-border rounded-2xl p-4 hover:border-primary/50 hover:shadow-md transition-all group"
          >
            <p className="text-xl font-black text-primary mb-0.5 group-hover:text-primary/80 transition-colors">{name}</p>
            <p className="text-xs text-muted-foreground leading-snug">{full}</p>
            <p className="text-xs text-muted-foreground mt-1 italic">{note}</p>
            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors mt-2" />
          </Link>
        ))}
      </div>

      {/* Universal scale */}
      <div>
        <h2 className="text-2xl font-bold mb-2">The Universal 1–10 Scale</h2>
        <p className="text-muted-foreground mb-5 text-sm leading-relaxed">
          Despite proprietary differences, all major grading companies align to a generally accepted universal standard of condition.
        </p>
        <div className="bg-card border border-border rounded-3xl overflow-hidden">
          <div className="grid grid-cols-[64px_160px_1fr] text-xs font-semibold uppercase tracking-widest text-muted-foreground bg-muted/50 px-6 py-3 border-b border-border">
            <span>Grade</span>
            <span>Condition</span>
            <span>General Characteristics</span>
          </div>
          {UNIVERSAL_SCALE.map(({ grade, label, condition }, i) => (
            <div
              key={grade}
              className={`grid grid-cols-[64px_160px_1fr] gap-2 px-6 py-5 items-start hover:bg-muted/20 transition-colors ${i < UNIVERSAL_SCALE.length - 1 ? 'border-b border-border/60' : ''}`}
            >
              <span className={`font-black text-xl leading-none ${gradeColor(grade)}`}>{grade}</span>
              <span className="font-semibold text-sm pt-0.5">{label}</span>
              <span className="text-sm text-muted-foreground leading-relaxed">{condition}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tips */}
      <div>
        <h2 className="text-2xl font-bold mb-5">Tips for Maximising Your Grade</h2>
        <div className="space-y-3">
          {TIPS.map(({ tip, detail }) => (
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
