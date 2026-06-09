import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import SEOHead from '@/components/SEOHead.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { Skeleton } from '@/components/ui/skeleton';

const GradingScalePage = () => {
  const { scale } = useParams();
  const [guide, setGuide] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchGuide = async () => {
      try {
        const { data } = await supabase.from('grading_companies').select('*').or(`slug.eq.${scale},id.eq.${scale}`).maybeSingle();
        if (!cancelled) setGuide(data);
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchGuide();
    return () => { cancelled = true; };
  }, [scale]);

  if (loading) return <div className="container-default section-padding"><Skeleton className="h-[400px] rounded-2xl" /></div>;
  if (!guide) return <div className="container-default section-padding text-center">Scale not found</div>;

  return (
    <div className="container-default section-padding min-h-screen max-w-4xl mx-auto">
      <SEOHead title={`${guide.abbreviation || guide.name} Grading Scale | CardPop`} description={guide.description || `Learn about the ${guide.name} grading scale and how cards are graded and authenticated.`} />

      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">{guide.name} ({guide.abbreviation})</h1>
        <p className="text-xl text-muted-foreground">Country: {guide.country || 'International'}</p>
      </div>

      <div className="prose prose-slate dark:prose-invert max-w-none bg-card border border-border p-8 md:p-12 rounded-3xl">
        <p className="lead">{guide.description}</p>
        <hr className="my-8" />
        <h3>Evaluation Standards</h3>
        <p>
          Centering, Corners, Edges, and Surface are critically evaluated.
          Detailed breakdown for {guide.name} is maintained internally and matched against market comps.
        </p>
      </div>
    </div>
  );
};

export default GradingScalePage;