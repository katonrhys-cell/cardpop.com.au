import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import DynamicNavigation from '@/components/DynamicNavigation.jsx';
import CategorySidebar from '@/components/CategorySidebar.jsx';
import { supabase } from '@/lib/supabaseClient.js';

const MarketplaceLayout = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStructure = async () => {
      try {
        // marketplaceStructure has no Supabase equivalent — load categories directly
        const { data: cats } = await supabase
          .from('categories')
          .select('*')
          .is('parent_id', null)
          .order('name');
        setCategories(cats || []);
      } catch (error) {
        console.error('Failed to load marketplace structure:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStructure();
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <DynamicNavigation categories={categories} />
      
      <div className="max-w-[100rem] mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 flex flex-col md:flex-row gap-8 pb-12">
        {/* Mobile Sidebar Toggle */}
        <div className="md:hidden flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold font-heading">Marketplace</h2>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Menu className="w-4 h-4" />
                Categories
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 p-0 border-r-border">
              <CategorySidebar categories={categories} className="border-0 shadow-none rounded-none h-full" />
            </SheetContent>
          </Sheet>
        </div>

        {/* Desktop Sidebar */}
        <aside className="hidden md:block w-64 flex-shrink-0">
          <div className="sticky top-28">
            <CategorySidebar categories={categories} />
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0">
          <Outlet context={{ categories }} />
        </main>
      </div>
    </div>
  );
};

export default MarketplaceLayout;