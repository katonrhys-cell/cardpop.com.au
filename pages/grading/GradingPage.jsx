import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { SearchCheck, BookOpen, BarChart2, Building2, ArrowRight, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SECTIONS = [
  {
    href: '/grading/what-is-grading',
    icon: BookOpen,
    title: 'What is Card Grading?',
    description:
      'Learn the basics of card grading, why collectors grade their cards, and the benefits of encapsulated cards in the marketplace.',
    cta: 'READ GUIDE',
  },
  {
    href: '/grading/scales',
    icon: BarChart2,
    title: 'Grading Scales',
    description:
      'Dive deep into the 1–10 condition scales used by major authenticators. Understand what separates a Mint 9 from a Gem Mint 10.',
    cta: 'VIEW SCALES',
  },
  {
    href: '/grading/companies',
    icon: Building2,
    title: 'Grading Companies',
    description:
      'Compare the top third-party grading services like PSA, BGS, CGC, and ACE. Learn their histories and specialized features.',
    cta: 'COMPARE SERVICES',
  },
];

const GradingPage = () => (
  <div className="min-h-screen bg-background">
    <Helmet><title>Grading Hub | CardPop</title></Helmet>

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

      {/* Section cards */}
      <div className="space-y-4">
        {SECTIONS.map(({ href, icon: Icon, title, description, cta }) => (
          <Link
            key={href}
            to={href}
            className="block bg-card border border-border rounded-3xl p-8 hover:border-primary/50 hover:shadow-md transition-all group"
          >
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
              <Icon className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-2xl font-bold mb-3 group-hover:text-primary transition-colors">{title}</h3>
            <p className="text-muted-foreground mb-6 leading-relaxed">{description}</p>
            <span className="flex items-center gap-2 text-primary font-bold text-sm tracking-widest uppercase">
              {cta} <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
        ))}
      </div>

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
        <Button size="lg" className="w-full sm:w-auto px-10">Apply as Partner</Button>
      </section>

    </div>
  </div>
);

export default GradingPage;
