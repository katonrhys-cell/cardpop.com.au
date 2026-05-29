import React, { useState, useEffect } from 'react';
import { Store, TrendingUp, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabaseClient.js';
import { toast } from 'sonner';

const MarketplaceManagementPage = () => {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchListings = async () => {
      try {
        const { data, error } = await supabase.from('listings').select('*, seller:profiles!seller_id(id, display_name, username)').order('created_at', { ascending: false }).limit(20);
        if (error) throw error;
        setListings(data ?? []);
      } catch (error) {
        console.error(error);
        toast.error("Failed to load marketplace data.");
      } finally {
        setLoading(false);
      }
    };
    fetchListings();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading">Marketplace Management</h1>
        <p className="text-muted-foreground text-sm">Oversee user listings, disputes, and marketplace health.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Active Listings</CardTitle>
            <Store className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{listings.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Monthly Volume</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$12,450</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Reported Issues</CardTitle>
            <AlertTriangle className="w-4 h-4 text-[hsl(var(--admin-warning))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2</div>
          </CardContent>
        </Card>
      </div>

      <Card className="p-4 border-border shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Recent Listings</h2>
        <div className="admin-table-container">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Seller ID</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-4">Loading...</TableCell></TableRow>
              ) : listings.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-4">No recent listings.</TableCell></TableRow>
              ) : (
                listings.map(l => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.title}</TableCell>
                    <TableCell className="text-muted-foreground">{l.seller}</TableCell>
                    <TableCell>${l.price?.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{l.status || 'active'}</Badge>
                    </TableCell>
                    <TableCell>{new Date(l.created).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
};

export default MarketplaceManagementPage;