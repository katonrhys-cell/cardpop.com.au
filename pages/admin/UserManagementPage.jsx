
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Search, MoreHorizontal, Shield, ChevronLeft, Users, X } from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabaseClient.js';
import { isVerified } from '@/utils/verification.js';
import { apiServerClient as apiClient } from '@/lib/apiServerClient.js';
import { toast } from 'sonner';
import { useAdmin } from '@/contexts/AdminContext.jsx';
import { useDebounce } from '@/hooks/useDebounce.js';

const UserManagementPage = () => {
  const navigate = useNavigate();
  const { logAdminAction } = useAdmin();
  
  const [users, setUsers] = useState([]);
  const [userCounts, setUserCounts] = useState({}); // Cache for related data counts
  const [loading, setLoading] = useState(true);
  
  // Filters & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 500);
  const [statusFilter, setStatusFilter] = useState('all');
  const [verificationFilter, setVerificationFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const fetchRelatedCounts = async (userList) => {
    const newCounts = { ...userCounts };

    await Promise.all(userList.map(async (u) => {
      if (newCounts[u.id]) return; // Skip if already cached

      try {
        // Using getList with limit 1 just to get totalItems efficiently
        const [vaultRes, ordersRes] = await Promise.all([
          supabase.from('vault_items').select('id', { count: 'exact', head: true }).eq('owner_id', u.id),
          supabase.from('orders').select('id', { count: 'exact', head: true }).or(`buyer_id.eq.${u.id},seller_id.eq.${u.id}`),
        ]);

        // Supabase resolves (rather than rejects) on a query error, so the
        // catch below never fires for one — log it so a false "0" isn't
        // completely silent, while still falling back gracefully per-row.
        if (vaultRes.error || ordersRes.error) {
          console.error(`[UserManagementPage] related-count error for user ${u.id}:`, vaultRes.error, ordersRes.error);
        }
        newCounts[u.id] = { vault: vaultRes.count ?? 0, orders: ordersRes.count ?? 0 };
      } catch (e) {
        newCounts[u.id] = { vault: 0, orders: 0 };
      }
    }));

    setUserCounts(newCounts);
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase.from('profiles').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range((page - 1) * 20, page * 20 - 1);

      if (debouncedSearch) {
        query = query.or(`display_name.ilike.%${debouncedSearch}%,username.ilike.%${debouncedSearch}%`);
      }
      if (statusFilter === 'admin') query = query.eq('is_admin', true);
      if (statusFilter === 'regular') query = query.eq('is_admin', false);
      if (verificationFilter === 'verified') query = query.eq('is_verified', true);
      if (verificationFilter === 'unverified') query = query.eq('is_verified', false);

      const { data: records, count, error } = await query;
      if (error) throw error;

      setUsers(records ?? []);
      setTotalPages(Math.ceil((count ?? 0) / 20));
      setTotalItems(count ?? 0);

      fetchRelatedCounts(records ?? []);

    } catch (error) {
      toast.error("Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, verificationFilter, page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Page is reset to 1 inside the filter change handlers (search/role/verification/
  // clear) rather than in an effect, so the filter change and the page reset land
  // in the same batched render — fetchUsers is recreated once and fires a single
  // query instead of first re-fetching the old page number under the new filter.

  const handleRoleChange = async (userId, makeAdmin) => {
    try {
      // Privileged write: go through the admin-checked backend endpoint, never a
      // direct client-side profiles update (which would let any user self-promote).
      const res = await apiClient.fetch(`/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_admin: makeAdmin }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || 'Failed to update admin status');
      }
      toast.success(`User ${makeAdmin ? 'granted admin' : 'revoked admin'} access.`);
      logAdminAction('update_user_admin', { userId, is_admin: makeAdmin });
      setUsers(users.map(u => u.id === userId ? { ...u, is_admin: makeAdmin } : u));
    } catch (error) {
      toast.error("Failed to update admin status.");
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setVerificationFilter('all');
    setPage(1);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Helmet><title>User Management | Admin Portal</title></Helmet>

      <AdminPageHeader
        icon={Users}
        title="User Management"
        subtitle={`Manage ${totalItems} registered accounts.`}
      />

      <Card className="p-0 border-border shadow-sm rounded-2xl overflow-hidden bg-card">
        <div className="p-4 border-b border-border bg-muted/20 flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search by email, name, or username..." 
              className="pl-9 h-10 rounded-xl bg-background border-border"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[140px] h-10 rounded-xl bg-background">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admins</SelectItem>
                <SelectItem value="regular">Regular Users</SelectItem>
              </SelectContent>
            </Select>

            <Select value={verificationFilter} onValueChange={(v) => { setVerificationFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[140px] h-10 rounded-xl bg-background">
                <SelectValue placeholder="Verification" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="unverified">Unverified</SelectItem>
              </SelectContent>
            </Select>

            {(searchTerm || statusFilter !== 'all' || verificationFilter !== 'all') && (
              <Button variant="ghost" onClick={clearFilters} className="h-10 px-3 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4 mr-2" /> Clear
              </Button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto relative w-full">
          <Table className="w-full">
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="font-semibold">User</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold text-center">Vault Items</TableHead>
                <TableHead className="font-semibold text-center">Orders</TableHead>
                <TableHead className="font-semibold">Joined</TableHead>
                <TableHead className="w-[80px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-10 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-12 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-12 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                    <Users className="w-10 h-10 mb-3 mx-auto opacity-20" />
                    <p className="font-medium text-foreground">No users found.</p>
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{user.display_name || user.username || 'Unnamed'}</span>
                        <span className="text-xs text-muted-foreground">@{user.username}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 items-start">
                        {user.is_admin ? (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary">Admin</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-200 text-[10px] px-1.5 py-0">User</Badge>
                        )}
                        {isVerified(user.is_verified) && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-blue-500/10 text-blue-600">Verified</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {userCounts[user.id] ? userCounts[user.id].vault : <span className="text-muted-foreground/50">-</span>}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {userCounts[user.id] ? userCounts[user.id].orders : <span className="text-muted-foreground/50">-</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString('en-AU')}
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
                          <DropdownMenuItem className="cursor-pointer" onClick={() => navigate(`/admin/users/${user.id}`)}>
                            View Full Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer" onClick={() => handleRoleChange(user.id, !user.is_admin)}>
                            <Shield className="w-4 h-4 mr-2" /> {user.is_admin ? 'Remove Admin' : 'Make Admin'}
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
              <Button variant="outline" size="sm" disabled={page === 1 || loading} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page === totalPages || loading} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default UserManagementPage;
