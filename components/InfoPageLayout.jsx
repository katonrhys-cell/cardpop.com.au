import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const InfoPageLayout = ({ title, description, eyebrow, icon: Icon, children, relatedLinks = [] }) => {
  return (
    <div className="min-h-screen bg-background">

      {/* ── Hero header ── */}
      <section className="bg-card border-b border-border py-20 text-center">
        <div className="container-default">
          {Icon && <Icon className="w-12 h-12 text-primary mx-auto mb-6" />}
          {eyebrow && (
            <Badge variant="outline" className="mb-4 text-xs font-semibold tracking-widest uppercase border-primary/40 text-primary px-3 py-1">
              {eyebrow}
            </Badge>
          )}
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{title}</h1>
          {description && (
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {description}
            </p>
          )}
        </div>
      </section>

      {/* ── Main content ── */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="prose prose-slate dark:prose-invert max-w-none">
          {children}
        </div>
      </div>

      {/* ── Contact CTA ── */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <section className="bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border border-primary/20 rounded-3xl p-10 text-center">
          <MessageCircle className="w-12 h-12 text-primary mx-auto mb-5" />
          <h2 className="text-2xl font-bold mb-3">Still have questions?</h2>
          <p className="text-muted-foreground max-w-md mx-auto mb-7 leading-relaxed">
            Our support team is here to help. Reach out and we'll get back to you as soon as possible.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Button asChild size="lg" className="rounded-full px-7 font-bold">
              <Link to="/contact">Contact Support</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-full px-7 font-bold">
              <Link to="/faq">Read FAQ <ArrowRight className="w-4 h-4 ml-2" /></Link>
            </Button>
          </div>
        </section>
      </div>

    </div>
  );
};

export default InfoPageLayout;
