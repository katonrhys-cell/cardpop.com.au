import React from 'react';
import { useParams, Link } from 'react-router-dom';
import SEOHead from '@/components/SEOHead.jsx';
import { ArrowLeft } from 'lucide-react';
import { GRADING_SCALES } from '@/data/gradingScales.js';

const COMPANY_DATA = GRADING_SCALES;

const gradeColor = (g) => {
  const n = parseFloat(g);
  if (n >= 9) return 'text-emerald-500';
  if (n >= 7) return 'text-blue-500';
  if (n >= 5) return 'text-amber-500';
  return 'text-destructive';
};

const OTHER_COMPANIES = Object.keys(COMPANY_DATA);

const GradingScalePage = () => {
  const { scale } = useParams();
  const company = COMPANY_DATA[scale?.toLowerCase()];

  if (!company) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold mb-2">Scale not found</p>
          <Link to="/grading/scales" className="text-primary text-sm hover:underline">Back to Grading Scales</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Explicit canonical: this page is routed at both /grading/scales/:scale
          and /grading/guide/:scale (and both forms are linked internally) —
          pin one so the two URLs don't compete as duplicates. */}
      <SEOHead
        title={`${company.name} Grading Scale — ${company.full} | CardPop Grading Hub`}
        description={`Complete ${company.name} grading scale breakdown for Australian collectors. Learn what each ${company.name} grade means and how to maximise your submission results.`}
        canonicalUrl={`/grading/scales/${scale}`}
      />

      <div className="container-default py-10 space-y-10">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
          <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
          <span>/</span>
          <Link to="/grading" className="hover:text-foreground transition-colors">Grading</Link>
          <span>/</span>
          <Link to="/grading/scales" className="hover:text-foreground transition-colors">Grading Scales</Link>
          <span>/</span>
          <span className="text-foreground font-medium">{company.name} Scale</span>
        </nav>

        <Link to="/grading/scales" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Grading Scales
        </Link>

        {/* Header */}
        <div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{company.name} ({company.full}) Grading Scale</h1>
          <p className="text-muted-foreground leading-relaxed">{company.intro}</p>
        </div>

        {/* AU Note */}
        <div className="bg-primary/5 border border-primary/20 rounded-2xl px-6 py-5">
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">Australian Collector Note</p>
          <p className="text-sm text-muted-foreground leading-relaxed">{company.auNote}</p>
        </div>

        {/* YouTube Video - Only show for PSA */}
        {scale?.toLowerCase() === 'psa' && (
          <div className="rounded-2xl overflow-hidden">
            <div className="aspect-video bg-black">
              <iframe
                width="100%"
                height="100%"
                src="https://www.youtube.com/embed/E9do7O74zM0"
                title="PSA Grading Scale Guide"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        )}

        {/* Scale table */}
        <div>
          <div className="bg-card border border-border rounded-3xl overflow-hidden">
            <div className="grid grid-cols-[64px_180px_1fr] text-xs font-semibold uppercase tracking-widest text-muted-foreground bg-muted/50 px-6 py-3 border-b border-border">
              <span>Grade</span>
              <span>Designation</span>
              <span>Condition Criteria</span>
            </div>
            {company.scales.map(({ grade, label, condition }, i) => (
              <div
                key={grade}
                className={`grid grid-cols-[64px_180px_1fr] gap-3 px-6 py-5 items-start hover:bg-muted/20 transition-colors ${i < company.scales.length - 1 ? 'border-b border-border/60' : ''}`}
              >
                <span className={`font-black text-xl leading-none ${gradeColor(grade)}`}>{grade}</span>
                <span className={`font-semibold text-sm pt-0.5 ${gradeColor(grade)}`}>{label}</span>
                <span className="text-sm text-muted-foreground leading-relaxed">{condition}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Other company scales */}
        <div>
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3">Compare Other Scales</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {OTHER_COMPANIES.filter(s => s !== scale?.toLowerCase()).map(s => (
              <Link
                key={s}
                to={`/grading/scales/${s}`}
                className="bg-card border border-border rounded-xl p-4 hover:border-primary/50 hover:shadow-md transition-all group text-center"
              >
                <p className="text-lg font-black text-primary group-hover:text-primary/80 transition-colors">{COMPANY_DATA[s].name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{COMPANY_DATA[s].full}</p>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default GradingScalePage;
