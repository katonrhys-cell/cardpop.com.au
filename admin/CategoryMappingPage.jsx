import React, { useState, useEffect } from 'react';
import pb from '@/lib/pocketbaseClient.js';
import { Helmet } from 'react-helmet';
import { autoMapCategories } from '@/utils/categoryMappingEngine.js';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';

const CategoryMappingPage = () => {
  const [stats, setStats] = useState({ mapped: 0, unmapped: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [mappingLoading, setMappingLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const fetchStats = async () => {
    setLoading(true);
    try {
      // Very basic aggregate - in real PB you might use a custom endpoint or count queries
      const unmapped = await pb.collection('cardListings').getList(1, 1, { filter: 'categoryId = "" || categoryId = null', $autoCancel: false });
      const mapped = await pb.collection('cardListings').getList(1, 1, { filter: 'categoryId != "" && categoryId != null', $autoCancel: false });
      
      setStats({
        unmapped: unmapped.totalItems,
        mapped: mapped.totalItems,
        total: unmapped.totalItems + mapped.totalItems
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
    <div className="space-y-6 max-w-5xl">
      <Helmet><title>Category Mapping Tools | Admin</title></Helmet>
      
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold font-heading">Category Mapping Engine</h1>
        <Button onClick={handleAutoMap} disabled={mappingLoading || stats.unmapped === 0} className="gap-2 font-bold">
          {mappingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
          Auto-Map Unassigned
        </Button>
      </div>

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