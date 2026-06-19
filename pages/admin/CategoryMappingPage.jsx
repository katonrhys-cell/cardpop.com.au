import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { Helmet } from 'react-helmet';
import { autoMapCategories } from '@/utils/categoryMappingEngine.js';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Wand2 } from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';
import { toast } from 'sonner';

const CategoryMappingPage = () => {
  const [stats, setStats] = useState({ mapped: 0, unmapped: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [mappingLoading, setMappingLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const fetchStats = async () => {
    setLoading(true);
    try {
      // cardListings → listings table; category mapped via category_id
      const [unmappedRes, mappedRes] = await Promise.all([
        supabase.from('listings').select('*', { count: 'exact' }).is('category_id', null).limit(1),
        supabase.from('listings').select('*', { count: 'exact' }).not('category_id', 'is', null).limit(1)
      ]);

      const unmappedCount = unmappedRes.count || 0;
      const mappedCount = mappedRes.count || 0;

      setStats({
        unmapped: unmappedCount,
        mapped: mappedCount,
        total: unmappedCount + mappedCount
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleAutoMap = async () => {
    setMappingLoading(true);
    setProgress(0);
    const result = await autoMapCategories(setProgress);
    
    if (result.success) {
      toast.success(`Successfully mapped ${result.mappedCount} listings!`);
      fetchStats();
    } else {
      toast.error(result.error || "Failed to auto-map");
    }
    setMappingLoading(false);
  };

  return (
    <div className="space-y-6">
      <Helmet><title>Category Mapping Tools | Admin</title></Helmet>

      <AdminPageHeader
        icon={Wand2}
        title="Category Mapping Engine"
        subtitle="Auto-map listings to the correct product categories."
      >
        <Button onClick={handleAutoMap} disabled={mappingLoading || stats.unmapped === 0} variant="outline" className="gap-2 font-bold rounded-xl h-10 px-4 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
          {mappingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
          Auto-Map Unassigned
        </Button>
      </AdminPageHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
          <p className="text-muted-foreground font-medium mb-1">Total Listings</p>
          <p className="text-4xl font-bold">{loading ? '-' : stats.total}</p>
        </div>
        <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
          <p className="text-muted-foreground font-medium mb-1">Mapped</p>
          <p className="text-4xl font-bold text-primary">{loading ? '-' : stats.mapped}</p>
        </div>
        <div className="bg-card p-6 rounded-xl border border-destructive/30 shadow-sm">
          <p className="text-destructive font-medium mb-1">Unmapped</p>
          <p className="text-4xl font-bold text-destructive">{loading ? '-' : stats.unmapped}</p>
        </div>
      </div>

      {mappingLoading && (
        <div className="bg-card p-6 rounded-xl border border-border">
          <p className="mb-2 font-medium">Mapping in progress... {progress}%</p>
          <div className="w-full bg-muted rounded-full h-2">
            <div className="bg-primary h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      )}

      <div className="admin-table-container mt-8">
        <div className="p-4 border-b border-border bg-muted/20">
          <h3 className="font-bold">Recent Unmapped Listings</h3>
        </div>
        <div className="p-8 text-center text-muted-foreground">
          {stats.unmapped === 0 ? "All listings are currently mapped!" : "Use the Auto-Map tool above to process unmapped listings."}
        </div>
      </div>
    </div>
  );
};

export default CategoryMappingPage;