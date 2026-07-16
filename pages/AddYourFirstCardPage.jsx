import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Plus, ShieldCheck, TrendingUp, Layers, Award } from 'lucide-react';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const AddYourFirstCardPage = () => {
  return (
    <div className="min-h-screen flex flex-col bg-muted/30 font-sans">
      <Helmet>
        <title>Add Your First Card | Card Pop</title>
      </Helmet>
      <Header />
      
      <main className="flex-1 flex items-center justify-center p-4 py-12 md:py-16">
        <div className="max-w-6xl mx-auto w-full grid lg:grid-cols-2 gap-12 items-center">
          
          {/* Left Column: Copy & Actions */}
          <div className="space-y-8">
            <div>
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-6">
                <Layers className="w-8 h-8" />
              </div>
              <h1 className="font-serif text-4xl md:text-5xl font-bold mb-4 text-foreground">
                Add Your First Card to Your Collection
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Start building your digital vault today. Track your portfolio's value, showcase your rarest pulls, and connect with the Australian trading card community.
              </p>
            </div>

            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <div className="mt-1 bg-background p-2 rounded-lg shadow-sm border border-border">
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-lg">Track Market Value</h3>
                  <p className="text-muted-foreground text-sm mt-1">Monitor real-time price fluctuations for your specific cards.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="mt-1 bg-background p-2 rounded-lg shadow-sm border border-border">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-lg">Secure Digital Vault</h3>
                  <p className="text-muted-foreground text-sm mt-1">Keep a pristine, organized record of your physical assets.</p>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <Button size="lg" asChild className="h-14 px-8 text-lg font-bold rounded-full shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
                <Link to="/vault/add">
                  <Plus className="w-5 h-5 mr-2" />
                  Add Your First Card
                </Link>
              </Button>
            </div>
          </div>

          {/* Right Column: Aspirational Card Showcase */}
          <div className="relative mt-8 lg:mt-0">
            {/* Background Glow */}
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/30 via-primary/5 to-transparent rounded-3xl transform rotate-2 scale-105 -z-10 blur-2xl opacity-70"></div>
            
            <Card className="relative overflow-hidden border-2 border-border shadow-2xl transition-transform duration-500 hover:shadow-primary/20">
              <div className="absolute top-0 right-0 p-4 z-10 flex gap-2">
                <Badge className="bg-black/90 text-white hover:bg-black/90 border-none px-3 py-1 text-sm shadow-xl backdrop-blur-md flex items-center gap-1.5 font-bold">
                  <Award className="w-3.5 h-3.5 text-primary" />
                  PSA 7 • NM
                </Badge>
              </div>
              
              <div className="aspect-[4/5] sm:aspect-square lg:aspect-[4/5] relative bg-secondary overflow-hidden">
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-secondary via-muted to-secondary">
                  <Layers className="w-20 h-20 text-muted-foreground/25" strokeWidth={1.25} />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
                <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                  <p className="text-xs font-bold uppercase tracking-wider text-primary mb-1">Pokemon • Extremely Rare Promo</p>
                  <h2 className="font-serif text-2xl md:text-3xl font-bold leading-tight drop-shadow-md">
                    1998 P.M. Japanese Promo Pikachu
                  </h2>
                  <p className="text-white/80 font-medium mt-1">Holo Illustrator</p>
                </div>
              </div>
              
              <CardContent className="p-6 bg-card">
                <div className="grid grid-cols-2 gap-y-5 gap-x-4 text-sm mb-6">
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wider font-bold mb-1">Collection</p>
                    <p className="font-bold text-foreground">Pokemon</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wider font-bold mb-1">Card Type</p>
                    <p className="font-bold text-foreground">Holographic Illustrator Promo</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wider font-bold mb-1">Condition</p>
                    <p className="font-bold text-foreground">Near Mint / NM</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wider font-bold mb-1">Cert Number</p>
                    <p className="font-bold text-foreground tabular-nums">57590433</p>
                  </div>
                </div>
                
                <div className="pt-5 border-t border-border">
                  <p className="text-muted-foreground text-xs uppercase tracking-wider font-bold mb-2">Description / Illustrator Honor Text</p>
                  <p className="text-sm text-foreground/90 italic leading-relaxed bg-muted/50 p-4 rounded-xl border border-border/50">
                    "We certify that your illustration is an excellent entry in the Pokémon Card Game Illustration Contest. Therefore, we state that you are an Officially Authorized Pokémon Card Illustrator and admire your skill."
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default AddYourFirstCardPage;