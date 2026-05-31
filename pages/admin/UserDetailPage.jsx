
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { ChevronLeft, Mail, MapPin, Calendar, ShieldAlert, KeyRound, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserDetails } from '@/hooks/useUserDetails.js';
import UserStatsCard from '@/components/admin/UserStatsCard.jsx';
import UserActionsModal from '@/components/admin/UserActionsModal.jsx';
import { supabase } from '@/lib/supabaseClient.js';

/**
 * DATA RELATIONSHIPS DOCUMENTATION:
 * - users -> user_vaults (1:N): User's inventory/collection. Filtered by `user_id`.
 * - users -> orders (1:N): User's transactions. Filtered by `buyer_id` OR `seller_id`.
 * - users -> reviews (1:N): Reviews left by the user. Filtered by `reviewer`.
 * - users -> user_addresses (1:N): Shipping/billing addresses. (Optional collection)
 * - users -> user_payment_methods (1:N): Saved payment methods. (Optional collection)
 * - users -> user_preferences (1:1): User settings. (Optional collection)
 */

const UserDetailPage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user, vaultProducts, ordersAsBuyer, ordersAsSeller, reviews, isLoading, error, refetch } = useUserDetails(userId);
  
  const [actionModal, setActionModal] = useState({ isOpen: false, type: null });

  const openAction = (type) => setActionModal({ isOpen: true, type });
  const closeAction = () => setActionModal({ isOpen: false, type: null });

  if (isLoading) {
    return (
      <div className="p-8 space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64 lg:col-span-1 rounded-2xl" />
          <Skeleton className="h-64 lg:col-span-2 rounded-2xl" />
        </div>
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="p-8 text-center max-w-2xl mx-auto mt-20">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">User Not Found</h2>
        <p className="text-muted-foreground mb-6">{error || "The requested user profile could not be loaded."}</p>
        <Button onClick={() => navigate('/admin/users')}>Return to User List</Button>
      </div>
    );
  }

  const avatarUrl = user.avatar_url || null;
  const displayName = user.display_name || user.username || user.email;
  const initials = displayName.substring(0, 2).toUpperCase();

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-300 py-6 px-4 sm:px-6 md:px-8 max-w-7xl mx-auto">
      <Helmet><title>{displayName} | User Details</title></Helmet>

      {/* Header Navigation */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={() => navigate('/admin/users')} className="h-10 rounded-xl px-3 shrink-0">
          <ChevronLeft className="w-5 h-5 mr-1" /> Back to Users
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Sidebar */}
        <Card className="border-border shadow-sm rounded-2xl lg:col-span-1 h-fit">
          <CardContent className="p-6 flex flex-col items-center text-center">
            <Avatar className="w-24 h-24 mb-4 border-4 border-background shadow-sm">
              <AvatarImage src={avatarUrl} alt={displayName} />
              <AvatarFallback className="text-2xl bg-primary/10 text-primary">{initials}</AvatarFallback>
            </Avatar>
            <h2 className="text-2xl font-bold font-serif">{displayName}</h2>
            <p className="text-muted-foreground mb-4">@{user.username || user.id}</p>
            
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              <Badge variant="secondary" className="bg-secondary text-secondary-foreground">{user.role || 'user'}</Badge>
              {user.verified && <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200">Verified</Badge>}
              {user.is_active === false && <Badge variant="destructive">Suspended</Badge>}
            </div>

            <div className="w-full space-y-3 text-sm text-left">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Mail className="w-4 h-4 shrink-0" />
                <span className="truncate text-foreground">{user.email}</span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <MapPin className="w-4 h-4 shrink-0" />
                <span className="truncate text-foreground">{user.location || 'Location not provided'}</span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <Calendar className="w-4 h-4 shrink-0" />
                <span className="truncate text-foreground">Joined {new Date(user.created_at).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="w-full mt-8 pt-6 border-t border-border space-y-3">
              <h3 className="text-sm font-semibold text-left text-muted-foreground uppercase tracking-wider mb-2">Admin Actions</h3>
              <Button 
                variant={user.is_active !== false ? "outline" : "default"} 
                className="w-full justify-start"
                onClick={() => openAction(user.is_active !== false ? 'suspend' : 'unsuspend')}
              >
                {user.is_active !== false ? (
                  <><ShieldAlert className="w-4 h-4 mr-2 text-destructive" /> Suspend Account</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4 mr-2" /> Reactivate Account</>
                )}
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => openAction('reset_password')}>
                <KeyRound className="w-4 h-4 mr-2" /> Send Password Reset
              </Button>
              <Button variant="outline" className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20" onClick={() => openAction('delete')}>
                <Trash2 className="w-4 h-4 mr-2" /> Delete Account
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
          <UserStatsCard 
            user={user} 
            vaultProductsCount={vaultProducts.length}
            ordersBuyerCount={ordersAsBuyer.length}
            ordersSellerCount={ordersAsSeller.length}
            reviewsCount={reviews.length}
          />

          {/* Vault Products Section */}
          <Card className="border-border shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border">
              <CardTitle className="text-lg font-serif">Vault Inventory ({vaultProducts.length})</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Listing Type</TableHead>
                    <TableHead>Added</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vaultProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No items in vault.</TableCell>
                    </TableRow>
                  ) : (
                    vaultProducts.slice(0, 5).map(product => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.card_name || product.name}</TableCell>
                        <TableCell>{product.categories?.name || product.collection || 'Uncategorized'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{product.listing_type || 'Private'}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{product.created_at ? new Date(product.created_at).toLocaleDateString() : '—'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {vaultProducts.length > 5 && (
                <div className="p-3 border-t border-border text-center bg-muted/10">
                  <Button variant="link" className="text-primary">View all {vaultProducts.length} items</Button>
                </div>
              )}
            </div>
          </Card>

          {/* Orders Section */}
          <Card className="border-border shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border">
              <CardTitle className="text-lg font-serif">Recent Orders</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordersAsBuyer.length === 0 && ordersAsSeller.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No order history.</TableCell>
                    </TableRow>
                  ) : (
                    [...ordersAsBuyer.map(o => ({...o, userRole: 'Buyer'})), ...ordersAsSeller.map(o => ({...o, userRole: 'Seller'}))]
                      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                      .slice(0, 5)
                      .map(order => (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono text-xs">{order.order_number || order.id.substring(0,8)}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={order.userRole === 'Buyer' ? 'bg-blue-500/10 text-blue-600' : 'bg-purple-500/10 text-purple-600'}>
                              {order.userRole}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{order.total_aud != null ? `$${Number(order.total_aud).toFixed(2)}` : '—'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{order.status}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{order.created_at ? new Date(order.created_at).toLocaleDateString() : '—'}</TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </div>

      <UserActionsModal 
        isOpen={actionModal.isOpen} 
        onClose={closeAction} 
        actionType={actionModal.type} 
        user={user}
        onComplete={refetch}
      />
    </div>
  );
};

export default UserDetailPage;
