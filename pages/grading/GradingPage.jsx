import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import pb from '@/lib/pocketbaseClient';
import { Skeleton } from '@/components/ui/skeleton';
import { SearchCheck } from 'lucide-react';

const GradingPage = () => {
  const [guides, setGuides] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGuides = async () => {
      try {
        const res = await pb.collection('grading_guides').getList(1, 10, { $autoCancel: false });
        setGuides(res.items);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchGuides();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Helmet><title>Grading Hub | CardPop</title></Helmet>

      <section className="bg-secondary/30 border-b border-border py-20 text-center">
        <div className="container-default">
          <SearchCheck className="w-12 h-12 text-primary mx-auto mb-6" />
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Grading Intelligence</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Comprehensive guides and standards for all major card grading services. 
            Understand the scales before you buy or grade.
          </p>
        </div>
      </section>

      <section className="container-default section-padding">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)
          ) : (
            guides.map(guide => (
              <Link key={guide.id} to={`/grading/guide/${guide.gradeType}`} className="bg-card border border-border p-8 rounded-3xl card-hover flex flex-col items-center text-center">
                <h3 className="font-bold text-3xl mb-2">{guide.gradingService}</h3>
                <p className="text-primary font-medium mb-4">{guide.gradeType}</p>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {guide.description || `Scale: ${guide.scaleMin} to ${guide.scaleMax}. Click to view full standards.`}
                </p>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
};

export default GradingPage;