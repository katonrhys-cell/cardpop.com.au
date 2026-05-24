import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Breadcrumb from '@/components/Breadcrumb.jsx';

const InfoPageLayout = ({ title, description, breadcrumbs, children, relatedLinks = [] }) => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header Section */}
      <div className="bg-card border-b border-border py-12 md:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {breadcrumbs && (
            <div className="flex justify-center mb-6">
              <Breadcrumb items={breadcrumbs} />
            </div>
          )}
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{title}</h1>
          {description && (
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {description}
            </p>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="prose prose-slate dark:prose-invert max-w-none">
          {children}
        </div>
      </div>

      {/* Contact CTA */}
      <div className="bg-secondary/50 border-t border-border py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Still have questions?</h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Our support team is here to help. Reach out to us and we'll get back to you as soon as possible.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button asChild size="lg">
              <Link to="/contact">Contact Support</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/faq">Read FAQ</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InfoPageLayout;