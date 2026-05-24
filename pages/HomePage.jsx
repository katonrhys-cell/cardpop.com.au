
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, ShieldCheck, Zap, TrendingUp, Search, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import pb from '@/lib/pocketbaseClient.js';
import VaultListingCard from '@/components/VaultListingCard.jsx';
import SellerCard from '@/components/SellerCard.jsx';
import { Skeleton } from '@/components/ui/skeleton';

const HomePage = () => {
  const [featuredCards, setFeaturedCards] = useState([]);
  const [featuredSellers, setFeaturedSellers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchHomeData = async () => {
      try {
        // Fetch featured sellers
        const sellersRes = await pb.collection('featuredSellers').getList(1, 4, {
          expand: 'seller_id',
          filter: 'is_active = true',
          sort: 'order',
          $autoCancel: false
        });

        // Fetch recent vault listings instead of featuredCards to ensure we have valid data
        const recentListings = await pb.collection('trading_cards').getList(1, 4, {
          filter: '(is_for_sale = true || is_for_trade = true)',
          sort: '-created',
          $autoCancel: false
        });

        const productIds = [...new Set(recentListings.items.map(i => i.product_id).filter(Boolean))];
        const userIds = [...new Set(recentListings.items.map(i => i.user_id).filter(Boolean))];

        let catalogProducts = [];
        let customCards = [];
        let users = [];

        if (productIds.length > 0) {
          const idFilter = productIds.map(id => `id="${id}"`).join('||');
          try { catalogProducts = await pb.collection('officialCatalog').getFullList({ filter: idFilter, $autoCancel: false }); } catch (e) {}
          try { customCards = await pb.collection('cards').getFullList({ filter: idFilter, $autoCancel: false }); } catch (e) {}
        }

        if (userIds.length > 0) {
          try {
            users = await pb.collection('users').getFullList({
              filter: userIds.map(id => `id="${id}"`).join('||'),
              $autoCancel: false
            });
          } catch (e) {}
        }

        const mappedListings = recentListings.items.map(item => {
          const product = catalogProducts.find(p => p.id === item.product_id) || customCards.find(c => c.id === item.product_id) || null;
          const user = users.find(u => u.id === item.user_id) || null;
          return { ...item, product, user };
        });

        if (isMounted) {
          const sellers = sellersRes.items.map(item => item.expand?.seller_id).filter(Boolean);
          setFeaturedCards(mappedListings);
          setFeaturedSellers(sellers);
        }
      } catch (error) {
        console.error("Failed to fetch homepage data:", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchHomeData();

    return () => {
      isMounted = false;
    };
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };

  return (
    <div className="min-h-screen bg-background font-sans overflow-hidden">
      <Helmet>
        <title>CardPop | Australia's Trading Card Marketplace</title>
        <meta name="description" content="Buy, sell, and trade Pokémon, Magic: The Gathering, sports cards and more on CardPop — Australia's most trusted trading card platform." />
      </Helmet>

      {/* Hero Section */}
      <section className="relative min-h-[90dvh] flex items-center justify-center pt-20 pb-32 px-4 sm:px-6 lg:px-8">
        {/* Subtle Noise Overlay */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-soft-light bg-[url('data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjAwIDIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZmlsdGVyIGlkPSJhIj48ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iMC42NSIgbnVtT2N0YXZlcz0iMyIgc3RpdGNoVGlsZXM9InN0aXRjaCIvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbHRlcj0idXJsKCNhKSIvPjwvc3ZnPg==')]"></div>
        
        {/* Gradient Orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl -z-10 animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[30rem] h-[30rem] bg-blue-500/10 rounded-full blur-3xl -z-10"></div>

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted text-muted-foreground text-sm font-bold tracking-wide mb-8 border border-border shadow-sm">
              <Zap className="w-4 h-4 text-primary" />
              Australia's Trading Card Marketplace
            </span>

            <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold font-serif tracking-tight text-balance mb-8 leading-[1.1]">
              Buy, Sell & Trade Cards <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/80">
                Across Australia
              </span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed text-balance">
              The safest place to buy, sell and trade Pokémon, Magic, sports cards and more — with Australian sellers, AUD pricing, and real-time market data.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button asChild size="lg" className="w-full sm:w-auto h-14 px-8 rounded-2xl font-bold text-lg shadow-lg hover:shadow-primary/25 transition-all hover:-translate-y-0.5">
                <Link to="/marketplace">
                  Explore Marketplace <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto h-14 px-8 rounded-2xl font-bold text-lg border-2 hover:bg-muted transition-all">
                <Link to="/signup">
                  Create Free Vault
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Bento Grid Features */}
      <section className="py-24 bg-card border-y border-border relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold font-serif mb-4">Built for Serious Collectors</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">Everything you need to manage your collection and make informed trades.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[minmax(250px,auto)]">
            {/* Large Feature */}
            <div className="md:col-span-2 bg-secondary rounded-3xl p-8 md:p-12 flex flex-col justify-between relative overflow-hidden group">
              <div className="relative z-10 max-w-md">
                <div className="w-12 h-12 bg-background rounded-xl flex items-center justify-center mb-6 shadow-sm">
                  <ShieldCheck className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-2xl font-bold mb-3 text-secondary-foreground">Bank-Grade Security</h3>
                <p className="text-secondary-foreground/80 leading-relaxed">
                  Every transaction is protected by our advanced escrow system. Funds are only released when both parties are completely satisfied with the trade.
                </p>
              </div>
              <div className="absolute right-0 bottom-0 w-2/3 h-2/3 bg-gradient-to-tl from-primary/10 to-transparent rounded-tl-full transition-transform duration-500 group-hover:scale-110"></div>
            </div>

            {/* Small Feature 1 */}
            <div className="bg-muted rounded-3xl p-8 flex flex-col justify-between group hover:bg-muted/80 transition-colors">
              <div>
                <div className="w-12 h-12 bg-background rounded-xl flex items-center justify-center mb-6 shadow-sm">
                  <TrendingUp className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-foreground">Live Market Data</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Track real-time price movements and historical sales data to ensure you always get fair value.
                </p>
              </div>
            </div>

            {/* Small Feature 2 */}
            <div className="bg-muted rounded-3xl p-8 flex flex-col justify-between group hover:bg-muted/80 transition-colors">
              <div>
                <div className="w-12 h-12 bg-background rounded-xl flex items-center justify-center mb-6 shadow-sm">
                  <Search className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-foreground">Smart Discovery</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Find exactly what you're looking for with our advanced filtering and AI-powered search engine.
                </p>
              </div>
            </div>

            {/* Medium Feature */}
            <div className="md:col-span-2 bg-primary text-primary-foreground rounded-3xl p-8 md:p-12 flex flex-col sm:flex-row items-center justify-between gap-8 relative overflow-hidden">
              <div className="relative z-10 max-w-md">
                <h3 className="text-2xl md:text-3xl font-bold mb-4">Ready to start trading?</h3>
                <p className="text-primary-foreground/90 mb-8">
                  Join our community of verified collectors and start building your dream vault today.
                </p>
                <Button asChild variant="secondary" size="lg" className="rounded-xl font-bold text-primary hover:bg-background">
                  <Link to="/signup">Get Started Now</Link>
                </Button>
              </div>
              <div className="relative z-10 w-32 h-32 sm:w-48 sm:h-48 bg-primary-foreground/10 rounded-full flex items-center justify-center backdrop-blur-sm border border-primary-foreground/20">
                <Users className="w-16 h-16 sm:w-24 sm:h-24 text-primary-foreground/80" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Cards Section */}
      <section className="py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-12">
            <div>
              <h2 className="text-3xl font-bold font-serif mb-2">Recent Vault Additions</h2>
              <p className="text-muted-foreground">Fresh listings from Australian collectors.</p>
            </div>
            <Button asChild variant="ghost" className="hidden sm:flex font-bold hover:bg-muted">
              <Link to="/marketplace">View All <ArrowRight className="ml-2 w-4 h-4" /></Link>
            </Button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="space-y-4">
                  <Skeleton className="aspect-[4/5] w-full rounded-2xl" />
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : featuredCards.length > 0 ? (
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
            >
              {featuredCards.map(card => (
                <motion.div key={card.id} variants={itemVariants}>
                  <VaultListingCard listing={card} />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <div className="text-center py-12 bg-muted rounded-3xl border border-border">
              <p className="text-muted-foreground font-medium">No recent cards available at the moment.</p>
            </div>
          )}
          
          <div className="mt-8 text-center sm:hidden">
            <Button asChild variant="outline" className="w-full rounded-xl font-bold">
              <Link to="/marketplace">View All Listings</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Featured Sellers Section */}
      <section className="py-24 bg-muted/30 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold font-serif mb-4">Trusted Australian Sellers</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">Trade with confidence. Every seller is verified and rated by the CardPop community.</p>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-64 w-full rounded-3xl" />
              ))}
            </div>
          ) : featuredSellers.length > 0 ? (
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
            >
              {featuredSellers.map(seller => (
                <motion.div key={seller.id} variants={itemVariants}>
                  <SellerCard seller={seller} />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <div className="text-center py-12 bg-background rounded-3xl border border-border shadow-sm">
              <p className="text-muted-foreground font-medium">Seller profiles are currently being updated.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default HomePage;
