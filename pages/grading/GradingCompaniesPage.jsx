import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import pb from '@/lib/pocketbaseClient';
import { Building2, ArrowLeft, ArrowRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const GradingCompaniesPage = () => {
  const [guides, setGuides] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    pb.collection('grading_guides')
      .getList(1, 20, { sort: 'gradingService', $autoCancel: false })
      .then(res => setGuides(res.items))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Helmet><title>Grading Companies | CardPop</title></Helmet>

      <section className="bg-card border-b border-border py-20 text-center">
        <div className="container-default">
          <Building2 className="w-12 h-12 text-primary mx-auto mb-6" />
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Grading Companies</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Compare the top third-party grading services like PSA, BGS, CGC, and ACE.
            Learn their histories, scales, and specialised features.
          </p>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">

        <Link to="/grading" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Grading Hub
        </Link>

        {/* Company cards */}
        <div className="space-y-4">
          {loading ? (
            Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)
          ) : guides.length > 0 ? (
            guides.map(guide => (
              <Link
                key={guide.id}
                to={`/grading/guide/${guide.gradeType}`}
                className="block bg-card border border-border rounded-2xl p-7 hover:border-primary/50 hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-2xl font-bold mb-0.5 group-hover:text-primary transition-colors">
                      {guide.gradingService}
                    </h3>
                    <p className="text-primary text-sm font-medium mb-3">{guide.gradeType}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                      {guide.description || `Scale: ${guide.scaleMin}–${guide.scaleMax}. Click to view full standards.`}
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  Scale: {guide.scaleMin}–{guide.scaleMax}
                </p>
              </Link>
            ))
          ) : (
            <div className="text-center py-16 bg-muted/20 rounded-3xl border border-border border-dashed">
              <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="font-semibold">No grading companies listed yet</p>
              <p className="text-sm text-muted-foreground mt-1">Check back soon.</p>
            </div>
          )}
        </div>

        {/* Comparison table */}
        <div>
          <h2 className="text-2xl font-bold mb-5">Quick Comparison</h2>
          <div className="bg-card border border-border rounded-3xl overflow-hidden">
            <div className="grid grid-cols-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground bg-muted/50 px-5 py-3 border-b border-border">
              <span>Company</span>
              <span>Best For</span>
              <span>Turnaround</span>
              <span>AU Pricing</span>
            </div>
            {[
              { co: 'PSA',  for: 'Pokémon, Sports', time: '20–150 days', price: 'From $25 USD' },
              { co: 'BGS',  for: 'All TCG, Vintage', time: '15–90 days', price: 'From $22 USD' },
              { co: 'CGC',  for: 'All TCG',          time: '10–60 days', price: 'From $15 USD' },
              { co: 'ACE',  for: 'AU collectors',    time: '7–30 days',  price: 'From $25 AUD' },
            ].map(({ co, for: f, time, price }, i, arr) => (
              <div key={co} className={`grid grid-cols-4 px-5 py-4 text-sm ${i < arr.length - 1 ? 'border-b border-border/60' : ''} hover:bg-muted/20 transition-colors`}>
                <span className="font-bold text-primary">{co}</span>
                <span className="text-muted-foreground">{f}</span>
                <span className="text-muted-foreground">{time}</span>
                <span className="text-muted-foreground">{price}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default GradingCompaniesPage;
