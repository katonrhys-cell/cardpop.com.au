import React from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { Link } from 'react-router-dom';
import { ShieldCheck, Users, Sparkles, ArrowRight, Target, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const AboutPage = () => {
  return (
    <div className="flex flex-col bg-background min-h-screen">
      <SEOHead title="About CardPop | Australia's Trading Card Marketplace" description="Learn about CardPop — Australia's premier platform for buying, selling and trading Pokemon, Magic and sports cards." />

      {/* 1. HERO SECTION */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden bg-card border-b border-border shadow-sm">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.05),transparent_50%)]" />
        </div>
        <div className="max-w-[100rem] mx-auto px-4 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary mb-6 border border-primary/20">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-bold tracking-wide uppercase">Our Story</span>
          </div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-serif text-foreground mb-6 max-w-4xl mx-auto leading-tight">
            Elevating the Australian Collecting Experience
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto font-medium leading-relaxed">
            We built CardPop to bring trust, transparency, and community back to the hobby we love.
          </p>
        </div>
      </section>

      {/* 2. MISSION STATEMENT */}
      <section className="py-24 bg-background">
        <div className="max-w-[100rem] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div className="order-2 md:order-1 relative">
              <div className="aspect-square rounded-3xl overflow-hidden bg-card border border-border shadow-sm relative">
                <img 
                  src="https://images.unsplash.com/photo-1606660265514-358ebbadc80d?auto=format&fit=crop&w=800&q=80" 
                  alt="Collectors trading cards" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-8 -right-8 w-48 h-48 bg-primary/10 rounded-full blur-3xl -z-10" />
            </div>
            
            <div className="order-1 md:order-2 flex flex-col items-start bg-card p-10 rounded-3xl border border-border shadow-sm">
              <div className="w-14 h-14 bg-background border border-border rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                <Target className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-3xl md:text-4xl font-serif text-foreground mb-6">Our Mission</h2>
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                For too long, Australian collectors have dealt with fragmented marketplaces, high international shipping fees, and uncertain verification processes. CardPop was founded to solve these exact problems.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed">
                We provide a secure, localized platform where enthusiasts can discover rare items, trade with confidence, and connect with a passionate community of verified sellers and buyers across the country.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. HISTORY & TIMELINE */}
      <section className="py-24 bg-card border-y border-border shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="w-14 h-14 bg-background rounded-2xl shadow-sm border border-border flex items-center justify-center mx-auto mb-8">
            <History className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-3xl md:text-4xl font-serif text-foreground mb-12">How It Started</h2>
          
          <div className="space-y-12 text-left relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
            
            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
              <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-card bg-primary text-primary-foreground shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                <span className="text-xs font-bold">2022</span>
              </div>
              <Card className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 premium-card bg-background">
                <h3 className="font-bold text-xl mb-2 text-foreground">The Idea</h3>
                <p className="text-muted-foreground">Frustrated by the lack of a dedicated Australian platform, our founders sketched the initial concept for CardPop during a local trade night in Melbourne.</p>
              </Card>
            </div>

            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
              <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-card bg-primary text-primary-foreground shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                <span className="text-xs font-bold">2023</span>
              </div>
              <Card className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 premium-card bg-background">
                <h3 className="font-bold text-xl mb-2 text-foreground">Building the Vault</h3>
                <p className="text-muted-foreground">Development began on our proprietary Digital Vault system, allowing users to track their collection's real-time market value securely.</p>
              </Card>
            </div>

            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
              <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-card bg-primary text-primary-foreground shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                <span className="text-xs font-bold">2024</span>
              </div>
              <Card className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 premium-card bg-background">
                <h3 className="font-bold text-xl mb-2 text-foreground">Public Launch</h3>
                <p className="text-muted-foreground">CardPop officially launched to the public, onboarding over 5,000 verified Australian collectors in the first three months.</p>
              </Card>
            </div>

          </div>
        </div>
      </section>

      {/* 4. BRAND IDENTITY */}
      <section className="py-24 bg-background">
        <div className="max-w-[100rem] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif text-foreground mb-4">Our Core Values</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">The principles that guide every feature we build and every interaction we support.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[minmax(200px,auto)]">
            <Card className="md:col-span-2 premium-card p-8 flex flex-col justify-center bg-card text-foreground">
              <ShieldCheck className="w-10 h-10 text-primary mb-6" />
              <h3 className="text-2xl font-bold mb-3">Uncompromising Security</h3>
              <p className="text-muted-foreground text-lg max-w-md">Sellers are verified and payments run securely through Stripe. Every order is backed by our 14-day Buyer Protection Guarantee — a full refund if it doesn't arrive or isn't as described.</p>
            </Card>
            
            <Card className="premium-card p-8 flex flex-col justify-center bg-primary text-primary-foreground border-none shadow-md">
              <Users className="w-10 h-10 mb-6 opacity-90" />
              <h3 className="text-2xl font-bold mb-3">Community First</h3>
              <p className="text-primary-foreground/90">Built by collectors, for collectors. We prioritize features that bring people together.</p>
            </Card>

            <Card className="premium-card p-8 flex flex-col justify-center bg-card text-foreground">
              <h3 className="text-xl font-bold mb-3 text-foreground">Transparency</h3>
              <p className="text-muted-foreground">Clear fee structures, accurate market data, and honest condition reporting.</p>
            </Card>

            <Card className="md:col-span-2 premium-card p-8 flex flex-col justify-center relative overflow-hidden bg-card text-foreground">
              <div className="relative z-10">
                <h3 className="text-2xl font-bold mb-3 text-foreground">Continuous Innovation</h3>
                <p className="text-muted-foreground text-lg max-w-md">From our Digital Vault to real-time market analytics, we are constantly pushing the boundaries of what a collecting platform can be.</p>
              </div>
              <div className="absolute right-0 bottom-0 w-64 h-64 bg-background rounded-tl-full -z-0 opacity-50" />
            </Card>
          </div>
        </div>
      </section>

      {/* 5. TEAM SECTION */}
      <section className="py-24 bg-card border-t border-border shadow-sm">
        <div className="max-w-[100rem] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif text-foreground mb-4">Meet the Team</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">The passionate collectors and technologists behind CardPop.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { name: "Maya Chen", role: "Founder & CEO", specialty: "Vintage Pokémon", img: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80" },
              { name: "Raj Patel", role: "Head of Product", specialty: "Modern NBA", img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80" },
              { name: "Lucia Torres", role: "Community Director", specialty: "Magic: The Gathering", img: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80" }
            ].map((member, i) => (
              <Card key={i} className="premium-card overflow-hidden group bg-background">
                <div className="aspect-square overflow-hidden bg-card">
                  <img 
                    src={member.img} 
                    alt={member.name} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 grayscale-[20%]"
                  />
                </div>
                <div className="p-6 text-center">
                  <h3 className="text-xl font-bold text-foreground mb-1">{member.name}</h3>
                  <p className="text-primary font-medium text-sm mb-3">{member.role}</p>
                  <p className="text-sm text-muted-foreground">Specialty: {member.specialty}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 6. CTA SECTION */}
      <section className="py-24 bg-primary text-primary-foreground text-center px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-serif mb-6">Join the Revolution</h2>
          <p className="text-xl text-primary-foreground/90 mb-10">
            Whether you're looking to complete a master set or liquidate your collection, CardPop is your trusted partner.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button size="lg" variant="secondary" asChild className="h-14 px-8 text-lg font-bold rounded-xl shadow-lg bg-card text-foreground hover:bg-background">
              <Link to="/signup">Create Free Account</Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="h-14 px-8 text-lg font-bold rounded-xl border-primary-foreground/30 hover:bg-primary-foreground/10 text-primary-foreground">
              <Link to="/marketplace">Explore Marketplace <ArrowRight className="w-5 h-5 ml-2" /></Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;