import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import pb from '@/lib/pocketbaseClient';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { SearchCheck, BookOpen, BarChart2, Building2, ArrowRight, Store } from 'lucide-react';

const SECTIONS = [
  {
    id: 'what-is-grading',
    icon: BookOpen,
    title: 'What is Card Grading?',
    description:
      'Learn the basics of card grading, why collectors grade their cards, and the benefits of encapsulated cards in the marketplace.',
    cta: 'READ GUIDE',
  },
  {
    id: 'grading-scales',
    icon: BarChart2,
    title: 'Grading Scales',
    description:
      'Dive deep into the 1–10 condition scales used by major authenticators. Understand what separates a Mint 9 from a Gem Mint 10.',
    cta: 'VIEW SCALES',
  },
  {
    id: 'grading-companies',
    icon: Building2,
    title: 'Grading Companies',
    description:
      'Compare the top third-party grading services like PSA, BGS, CGC, and ACE. Learn their histories and specialized features.',
    cta: 'COMPARE SERVICES',
  },
];

const GradingPage = () => {
  const [guides, setGuides] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    pb.collection('grading_guides')
      .getList(1, 20, { sort: 'gradingService', $autoCancel: false })
      .then(res => setGuides(res.items))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet><title>Grading Hub | CardPop</title></Helmet>

      {/* Hero */}
      <section className="bg-card border-b border-border py-20 text-center">
        <div className="container-default">
          <SearchCheck className="w-12 h-12 text-primary mx-auto mb-6" />
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Grading Intelligence</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Comprehensive guides and standards for all major card grading services.
            Understand the scales before you buy or grade.
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-16">

        {/* Section navigation cards */}
        <div className="space-y-4">
          {SECTIONS.map(({ id, icon: Icon, title, description, cta }) => (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              className="w-full text-left bg-card border border-border rounded-3xl p-8 hover:border-primary/50 hover:shadow-md transition-all group"
            >
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
                <Icon className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-3 group-hover:text-primary transition-colors">{title}</h3>
              <p className="text-muted-foreground mb-6 leading-relaxed">{description}</p>
              <span className="flex items-center gap-2 text-primary font-bold text-sm tracking-widest uppercase">
                {cta} <ArrowRight className="w-4 h-4" />
              </span>
            </button>
          ))}
        </div>

        {/* What is Card Grading? */}
        <section id="what-is-grading" className="scroll-mt-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-2xl font-bold">What is Card Grading?</h2>
          </div>
          <div className="bg-card border border-border rounded-3xl p-8 space-y-4 text-muted-foreground leading-relaxed">
            <p>
              Card grading is the process of having a professional third-party company assess the condition
              of a trading card and assign it a numeric grade. The card is then sealed in a tamper-evident
              plastic case — called a "slab" — which displays the grade permanently.
            </p>
            <p>
              Grades typically range from 1 (Poor) to 10 (Gem Mint), with higher grades representing
              cards in progressively better condition. Graders examine four key areas: <strong className="text-foreground">centering</strong>,{' '}
              <strong className="text-foreground">corners</strong>, <strong className="text-foreground">edges</strong>, and{' '}
              <strong className="text-foreground">surface</strong>.
            </p>
            <p>
              Graded cards are highly sought after by collectors because the grade is independently verified,
              making it easier to buy and sell with confidence. A PSA 10 Charizard, for example, commands
              a significant premium over the same card ungraded — the encapsulation proves authenticity
              and condition.
            </p>
            <p>
              For Australian collectors, grading adds a layer of trust to the secondary market and can
              dramatically increase the resale value of your most prized cards.
            </p>
          </div>
        </section>

        {/* Grading Scales */}
        <section id="grading-scales" className="scroll-mt-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <BarChart2 className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-2xl font-bold">Grading Scales</h2>
          </div>
          <div className="bg-card border border-border rounded-3xl overflow-hidden">
            <div className="grid grid-cols-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground bg-muted/50 px-6 py-3 border-b border-border">
              <span>Grade</span>
              <span>Label</span>
              <span>Condition</span>
            </div>
            {[
              { grade: '10', label: 'Gem Mint', condition: 'Perfect in every way — virtually no flaws under magnification.' },
              { grade: '9',  label: 'Mint',     condition: 'One minor flaw allowed; otherwise perfect centering and surface.' },
              { grade: '8',  label: 'Near Mint–Mint', condition: 'Two minor flaws; slight imperfection on corners or surface.' },
              { grade: '7',  label: 'Near Mint', condition: 'Small flaws on corners or edges; surface may show minor scratches.' },
              { grade: '6',  label: 'Excellent–Mint', condition: 'Light wear; may have minor corner or edge issues.' },
              { grade: '5',  label: 'Excellent', condition: 'Obvious signs of wear; corners may show rounding.' },
              { grade: '4',  label: 'Very Good–Excellent', condition: 'Some rounding of corners and/or edges, light creasing possible.' },
              { grade: '3',  label: 'Very Good', condition: 'Significant creasing, rounding of corners, and surface wear.' },
              { grade: '2',  label: 'Good',      condition: 'Heavy wear throughout; major creases, scratches or stains.' },
              { grade: '1',  label: 'Poor',      condition: 'Heavily damaged; significant defects on both surfaces.' },
            ].map(({ grade, label, condition }) => (
              <div key={grade} className="grid grid-cols-3 gap-2 px-6 py-4 border-b border-border last:border-0 items-start hover:bg-muted/20 transition-colors">
                <span className="font-bold text-primary text-lg">{grade}</span>
                <span className="font-semibold text-sm">{label}</span>
                <span className="text-sm text-muted-foreground">{condition}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Grading Companies — dynamic from PocketBase */}
        <section id="grading-companies" className="scroll-mt-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-2xl font-bold">Grading Companies</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {loading ? (
              Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)
            ) : guides.length > 0 ? (
              guides.map(guide => (
                <Link
                  key={guide.id}
                  to={`/grading/guide/${guide.gradeType}`}
                  className="bg-card border border-border p-7 rounded-2xl hover:border-primary/50 hover:shadow-md transition-all group"
                >
                  <h3 className="font-bold text-2xl mb-1 group-hover:text-primary transition-colors">
                    {guide.gradingService}
                  </h3>
                  <p className="text-primary text-sm font-medium mb-3">{guide.gradeType}</p>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {guide.description || `Scale: ${guide.scaleMin}–${guide.scaleMax}. Click to view full standards.`}
                  </p>
                  <span className="flex items-center gap-1.5 mt-4 text-primary font-bold text-xs tracking-widest uppercase">
                    VIEW GUIDE <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </Link>
              ))
            ) : (
              <div className="col-span-2 text-center py-12 bg-muted/20 rounded-3xl border border-border border-dashed">
                <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="font-semibold">No grading companies listed yet</p>
                <p className="text-sm text-muted-foreground mt-1">Check back soon.</p>
              </div>
            )}
          </div>
        </section>

        {/* Local Game Store CTA */}
        <section className="bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border border-primary/20 rounded-3xl p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-5">
            <Store className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-3">Are you a Local Game Store?</h2>
          <p className="text-muted-foreground max-w-md mx-auto mb-7 leading-relaxed">
            Join the CardPop Retailer Network. Expand your reach, manage your inventory with our
            integrated tools, and connect with thousands of active collectors.
          </p>
          <Button size="lg" className="w-full sm:w-auto px-10">
            Apply as Partner
          </Button>
        </section>

      </div>
    </div>
  );
};

export default GradingPage;
