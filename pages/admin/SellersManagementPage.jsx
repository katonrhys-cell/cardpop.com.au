
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Search, Star, MoreHorizontal, ExternalLink, X, Eye } from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabaseClient.js';
import { isVerified } from '@/utils/verification.js';
import { toast } from 'sonner';
import { useAdmin } from '@/contexts/AdminContext.jsx';
import { useDebounce } from '@/hooks/useDebounce.js';

const SellersManagementPage = () => {
  const navigate = useNavigate();
  const { logAdminAction } = useAdmin();

  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);

  // Filters & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 500);
  const [featuredFilter, setFeaturedFilter] = useState('all');
  const [verifiedFilter, setVerifiedFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const fetchSellers = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('profiles')
        .select('id, display_name, username, business_name, avatar_url, business_logo_url, is_featured_seller, is_verified, is_active, rating, reviews_count, seller_tier, location_state', { count: 'exact' })
        .eq('is_sole_trader', true)
        .eq('is_active', true)
        .order('is_featured_seller', { ascending: false })
        .order('created_at', { ascending: false })
        .range((page - 1) * 20, page * 20 - 1);

      if (debouncedSearch) {
        query = query.or(`display_name.ilike.%${debouncedSearch}%,username.ilike.%${debouncedSearch}%,business_name.ilike.%${debouncedSearch}%`);
      }

      if (featuredFilter === 'featured') {
        query = query.eq('is_featured_seller', true);
      } else if (featuredFilter === 'not-featured') {
        query = query.eq('is_featured_seller', false);
      }

      if (verifiedFilter === 'verified') {
        query = query.eq('is_verified', true);
      } else if (verifiedFilter === 'unverified') {
        query = query.eq('is_verified', false);
      }

      const { data: records, count, error } = await query;
      if (error) throw error;

      setSellers(records ?? []);
      setTotalPages(Math.ceil((count ?? 0) / 20));
      setTotalItems(count ?? 0);
    } catch (error) {
      toast.error('Failed to load sellers.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, featuredFilter, verifiedFilter, page]);

  useEffect(() => {
    fetchSellers();
  }, [fetchSellers]);

  const handleToggleFeatured = async (sellerId, currentStatus) => {
    setUpdating(sellerId);
    try {
      const newStatus = !currentStatus;
      const { error } = await supabase
        .from('profiles')
        .update({ is_featured_seller: newStatus })
        .eq('id', sellerId);

      if (error) throw error;

      toast.success(newStatus ? 'Seller promoted to featured.' : 'Seller removed from featured.');
      logAdminAction('update_featured_seller', { sellerId, is_featured_seller: newStatus });

      setSellers(sellers.map(s => s.id === sellerId ? { ...s, is_featured_seller: newStatus } : s));
    } catch (error) {
      toast.error('Failed to update seller status.');
    } finally {
      setUpdating(null);
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFeaturedFilter('all');
    setVerifiedFilter('all');
    setPage(1);
  };

  const getInitials = (seller) => {
    const name = seller.display_name || seller.username || 'S';
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Helmet><title>Sellers Management | Admin Portal</title></Helmet>

      <AdminPageHeader
        icon={Star}
        title="Sellers Management"
        subtitle={`Manage ${totalItems} registered sellers and featured promotions.`}
      />

      <Card className="p-0 border-border shadow-sm rounded-2xl overflow-hidden bg-card">
        <div className="p-4 border-b border-border bg-muted/20 flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, username, or business..."
              className="pl-9 h-10 rounded-xl bg-background border-border"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <Select value={featuredFilter} onValueChange={(v) => {
              setFeaturedFilter(v);
              setPage(1);
            }}>
              <SelectTrigger className="w-[150px] h-10 rounded-xl bg-background">
                <SelectValue placeholder="Featured" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sellers</SelectItem>
                <SelectItem value="featured">Featured Only</SelectItem>
                <SelectItem value="not-featured">Not Featured</SelectItem>
              </SelectContent>
            </Select>

            <Select value={verifiedFilter} onValueChange={(v) => {
              setVerifiedFilter(v);
              setPage(1);
            }}>
              <SelectTrigger className="w-[150px] h-10 rounded-xl bg-background">
                <SelectValue placeholder="Verification" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="unverified">Unverified</SelectItem>
              </SelectContent>
            </Select>

            {(searchTerm || featuredFilter !== 'all' || verifiedFilter !== 'all') && (
              <Button
                variant="ghost"
                onClick={clearFilters}
                className="h-10 px-3 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4 mr-2" /> Clear
              </Button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto relative w-full">
          <Table className="w-full">
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="font-semibold">Seller</TableHead>
                <TableHead className="font-semibold">Business</TableHead>
                <TableHead className="font-semibold text-center">Rating</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold text-center">Featured</TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-10 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-12 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : sellers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                    <Star className="w-10 h-10 mb-3 mx-auto opacity-20" />
                    <p className="font-medium text-foreground">No sellers found.</p>
                  </TableCell>
                </TableRow>
              ) : (
                sellers.map((seller) => (
                  <TableRow key={seller.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={seller.avatar_url || seller.business_logo_url} alt={seller.display_name} />
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {getInitials(seller)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{seller.display_name || seller.username}</span>
                          <span className="text-xs text-muted-foreground">@{seller.username}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{seller.business_name || '—'}</span>
                        {seller.location_state && (
                          <span className="text-xs text-muted-foreground">{seller.location_state}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className="font-medium">{seller.rating?.toFixed(1) || '—'}</span>
                        {seller.rating && <span className="text-yellow-500">★</span>}
                        {seller.reviews_count && (
                          <span className="text-xs text-muted-foreground">({seller.reviews_count})</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 items-start">
                        {isVerified(seller.is_verified) && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-blue-500/10 text-blue-600">
                            Verified
                          </Badge>
                        )}
                        {seller.seller_tier && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                            {seller.seller_tier}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant={seller.is_featured_seller ? 'default' : 'outline'}
                        size="sm"
                        className={`w-full justify-center ${
                          seller.is_featured_seller ? 'bg-brand-red hover:bg-red-700' : ''
                        }`}
                        disabled={updating === seller.id}
                        onClick={() => handleToggleFeatured(seller.id, seller.is_featured_seller)}
                      >
                        <Star
                          className={`w-4 h-4 ${
                            seller.is_featured_seller ? 'fill-current' : ''
                          }`}
                        />
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 rounded-xl">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="cursor-pointer"
                            onClick={() => navigate(`/admin/users/${seller.id}`)}
                          >
                            View Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="cursor-pointer"
                            onClick={() => window.open(`/dealer/${seller.username}`, '_blank')}
                          >
                            <ExternalLink className="w-4 h-4 mr-2" />
                            View Public Store
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-border flex items-center justify-between bg-muted/10">
            <span className="text-sm text-muted-foreground">
              Showing page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1 || loading} onClick={() => setPage(p => p - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page === totalPages || loading} onClick={() => setPage(p => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Preview Section */}
      {sellers.filter(s => s.is_featured_seller).length > 0 && (
        <Card className="p-6 border-border shadow-sm rounded-2xl bg-card">
          <h3 className="text-lg font-semibold font-serif mb-4 flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Featured Sellers Preview
          </h3>
          <div className="text-sm text-muted-foreground mb-4">
            These sellers will appear on the home page's "Trusted Australian Sellers" section:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {sellers.filter(s => s.is_featured_seller).map(seller => (
              <div key={seller.id} className="p-4 rounded-xl bg-muted/30 border border-border hover:border-primary/50 transition-colors">
                <Avatar className="h-16 w-16 mb-3 mx-auto">
                  <AvatarImage src={seller.business_logo_url || seller.avatar_url} alt={seller.business_name} />
                  <AvatarFallback className="text-lg bg-primary/10 text-primary">
                    {getInitials(seller)}
                  </AvatarFallback>
                </Avatar>
                <h4 className="font-semibold text-foreground text-center mb-1">{seller.business_name || seller.display_name}</h4>
                <p className="text-xs text-muted-foreground text-center mb-2">@{seller.username}</p>
                <div className="flex items-center justify-center gap-1 text-sm">
                  {seller.rating && (
                    <>
                      <span className="font-medium">{seller.rating.toFixed(1)}</span>
                      <span className="text-yellow-500">★</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default SellersManagementPage;
