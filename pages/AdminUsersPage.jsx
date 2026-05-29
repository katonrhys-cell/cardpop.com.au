import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { toast } from 'sonner';
import { Search, RefreshCw, AlertTriangle, ShieldCheck, Lock, ChevronLeft, ChevronRight, User, MoreHorizontal, ShieldAlert } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import UserDetailModal from '@/components/UserDetailModal.jsx';

const USERS_PER_PAGE = 10;

const AdminUsersPage = () => {
  const [users, setUsers] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  
  const [selectedUser, setSelectedUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const buildFilter = useCallback(() => {
    return { search, statusFilter, dateFilter };
  }, [search, statusFilter, dateFilter]);

  const fetchUsers = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setError(null);
    try {
      const from = (page - 1) * USERS_PER_PAGE;
      const to = from + USERS_PER_PAGE - 1;

      let query = supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (search) {
        query = query.or(`username.ilike.%${search}%,display_name.ilike.%${search}%`);
      }
      if (statusFilter === 'verified') query = query.eq('is_verified', true);
      if (statusFilter === 'unverified') query = query.eq('is_verified', false);
      if (statusFilter === 'admin') query = query.eq('is_admin', true);
      // 'locked' filter has no equivalent in profiles — skip

      if (dateFilter !== 'all') {
        const now = new Date();
        let pastDate = new Date();
        if (dateFilter === '7days') pastDate.setDate(now.getDate() - 7);
        if (dateFilter === '30days') pastDate.setDate(now.getDate() - 30);
        if (dateFilter === 'thisYear') pastDate.setFullYear(now.getFullYear(), 0, 1);
        query = query.gte('created_at', pastDate.toISOString());
      }

      const { data, count, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      setUsers(data || []);
      setTotalItems(count || 0);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to load user list. Please try again.');
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [page, search, statusFilter, dateFilter]);

  useEffect(() => {
    fetchUsers(true);
  }, [fetchUsers]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchUsers(false);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchUsers]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const handleRoleChange = async (user, newRole) => {
    const displayName = user.display_name || user.username || user.id;
    if (!window.confirm(`Are you sure you want to change ${displayName}'s role to ${newRole.toUpperCase()}?`)) {
      return;
    }

    try {
      const isAdmin = newRole === 'admin';
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ is_admin: isAdmin })
        .eq('id', user.id);
      if (updateError) throw updateError;
      toast.success(`Successfully updated role to ${newRole} for ${displayName}`);
      fetchUsers(false);
    } catch (err) {
      console.error('Error updating role:', err);
      toast.error(err.message || 'Failed to update user role.');
    }
  };

  const totalPages = Math.ceil(totalItems / USERS_PER_PAGE) || 1;

  const handleRowClick = (user) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-AU', { 
      day: 'numeric', month: 'short', year: 'numeric' 
    }).format(date);
  };

  // accountLockedUntil not available in profiles schema; lock detection removed
  const isLocked = (_user) => false;

  return (
    <div className="min-h-screen bg-background text-foreground py-12">
      <Helmet>
        <title>Admin - User Management | CardPop</title>
      </Helmet>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col h-full">
        
        {/* Header & Filters */}
        <div className="flex flex-col gap-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-2">User Management</h1>
              <p className="text-muted-foreground">Manage accounts, verification status, and security settings.</p>
            </div>
            
            <Button 
              variant="outline" 
              onClick={() => fetchUsers(true)}
              className="w-full md:w-auto bg-card text-foreground border-border shadow-sm rounded-xl"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh Data
            </Button>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col lg:flex-row gap-4 items-end">
            <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by email or name..." 
                className="pl-9 h-11 text-foreground bg-background w-full rounded-xl"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </form>
            
            <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
              <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }}>
                <SelectTrigger className="h-11 w-full sm:w-[180px] bg-background rounded-xl">
                  <SelectValue placeholder="Status Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="unverified">Unverified</SelectItem>
                  <SelectItem value="locked">Locked Accounts</SelectItem>
                  <SelectItem value="admin">Admins Only</SelectItem>
                </SelectContent>
              </Select>

              <Select value={dateFilter} onValueChange={(val) => { setDateFilter(val); setPage(1); }}>
                <SelectTrigger className="h-11 w-full sm:w-[180px] bg-background rounded-xl">
                  <SelectValue placeholder="Registration Date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="7days">Last 7 Days</SelectItem>
                  <SelectItem value="30days">Last 30 Days</SelectItem>
                  <SelectItem value="thisYear">This Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Data Table Area */}
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col flex-1">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[300px]">User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Last Login</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              
              <TableBody>
                {isLoading && users.length === 0 ? (
                  [...Array(10)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-10 w-full bg-background" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-3/4 bg-background" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24 bg-background" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20 rounded-full bg-background" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-5 w-24 ml-auto bg-background" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-8 rounded-md ml-auto bg-background" /></TableCell>
                    </TableRow>
                  ))
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                      <AlertTriangle className="w-10 h-10 text-destructive mx-auto mb-3 opacity-80" />
                      <p className="font-medium text-lg">{error}</p>
                      <Button variant="link" onClick={() => fetchUsers(true)} className="mt-2 text-primary font-bold">Try Again</Button>
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                      <User className="w-10 h-10 mx-auto mb-3 opacity-20" />
                      <p className="font-medium text-lg text-foreground">No users found</p>
                      <p className="text-sm">Adjust your filters or search query to find results.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow 
                      key={user.id} 
                      className="cursor-pointer hover:bg-muted/50 transition-colors border-border"
                      onClick={() => handleRowClick(user)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt={user.display_name} className="w-9 h-9 rounded-lg object-cover ring-1 ring-border" />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-background border border-border flex items-center justify-center shrink-0 shadow-sm">
                              <User className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-foreground truncate">{user.display_name || user.username || 'Anonymous'}</span>
                            {user.is_admin && (
                              <span className="text-[10px] font-bold text-destructive uppercase tracking-wider mt-0.5">Admin</span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm truncate max-w-[200px] font-medium">
                        {user.username || user.id}
                      </TableCell>
                      <TableCell className="text-sm text-foreground font-medium">
                        {formatDate(user.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {user.is_verified ? (
                            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-transparent font-bold shadow-sm">Verified</Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground font-bold bg-background shadow-sm">Unverified</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground font-medium">
                        {formatDate(user.join_date)}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()} className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-background">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 bg-card border-border shadow-md">
                            <DropdownMenuItem onClick={() => handleRowClick(user)} className="cursor-pointer font-medium">
                              <User className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-border" />
                            {user.is_admin ? (
                              <DropdownMenuItem
                                onClick={() => handleRoleChange(user, 'user')}
                                className="cursor-pointer text-muted-foreground font-medium"
                              >
                                <ShieldCheck className="w-4 h-4 mr-2" />
                                Demote to User
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => handleRoleChange(user, 'admin')}
                                className="cursor-pointer text-destructive focus:text-destructive font-bold"
                              >
                                <ShieldAlert className="w-4 h-4 mr-2" />
                                Promote to Admin
                              </DropdownMenuItem>
                            )}
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
          <div className="mt-auto border-t border-border p-4 bg-background flex items-center justify-between">
            <p className="text-sm text-muted-foreground font-medium hidden sm:block">
              Showing {Math.min((page - 1) * USERS_PER_PAGE + 1, totalItems)} to {Math.min(page * USERS_PER_PAGE, totalItems)} of {totalItems} entries
            </p>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || isLoading}
                className="bg-card border-border shadow-sm rounded-lg"
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Prev
              </Button>
              <span className="text-sm font-bold text-foreground px-3">
                Page {page} of {totalPages}
              </span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || isLoading || totalPages === 0}
                className="bg-card border-border shadow-sm rounded-lg"
              >
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>

      </div>

      <UserDetailModal 
        user={selectedUser} 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onUserUpdate={() => fetchUsers(false)} 
      />
    </div>
  );
};

export default AdminUsersPage;