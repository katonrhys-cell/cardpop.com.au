
import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ChevronLeft, Mail, MapPin, Calendar, ShieldAlert, KeyRound, Trash2, CheckCircle2, AlertCircle, User, BadgeCheck, Sparkles, Store } from 'lucide-react';
import { toast } from 'sonner';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { useUserDetails } from '@/hooks/useUserDetails.js';
import UserStatsCard from '@/components/admin/UserStatsCard.jsx';
import UserActionsModal from '@/components/admin/UserActionsModal.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import apiServerClient from '@/lib/apiServerClient.js';
import { isVerified } from '@/utils/verification.js';
import Turnstile from '@/components/Turnstile.jsx';
import { TURNSTILE_ENABLED } from '@/lib/turnstile.js';

/**
 * DATA RELATIONSHIPS DOCUMENTATION:
 * - users -> user_vaults (1:N): User's inventory/collection. Filtered by `user_id`.
 * - users -> orders (1:N): User's transactions. Filtered by `buyer_id` OR `seller_id`.
 * - users -> seller_ratings (1:N): Reviews left by the user. Filtered by `reviewer_id`.
 * - users -> user_addresses (1:N): Shipping/billing addresses. (Optional collection)
 * - users -> user_payment_methods (1:N): Saved payment methods. (Optional collection)
 * - users -> user_preferences (1:1): User settings. (Optional collection)
 */

const UserDetailPage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user, vaultProducts, ordersAsBuyer, ordersAsSeller, reviews, isLoading, error, refetch } = useUserDetails(userId);
  
  const [actionModal, setActionModal] = useState({ isOpen: false, type: null });
  const [flagSaving, setFlagSaving] = useState(false);
  // Turnstile token for the password-reset action (Supabase CAPTCHA gates the
  // recover endpoint even for admin-triggered resets).
  const [resetCaptchaToken, setResetCaptchaToken] = useState('');
  const resetTurnstileRef = useRef(null);
  // Type-to-confirm safety net for the irreversible-from-here delete action.
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const openAction = (type) => setActionModal({ isOpen: true, type });
  const closeAction = () => { setActionModal({ isOpen: false, type: null }); setResetCaptchaToken(''); setDeleteConfirmText(''); };

  // Stripe Identity name-mismatch review. The mismatch flag and the document's
  // legal name are service-role-only columns, so both come from the admin
  // backend, and the resolution goes through it too.
  const [identityMismatch, setIdentityMismatch] = useState(null);
  const [reviewSaving, setReviewSaving] = useState(false);
  // Live "every name Stripe holds for this user" panel (profile vs ID document
  // vs Connect payout account vs billing customer), computed by the backend.
  const [stripeNames, setStripeNames] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiServerClient.fetch('/admin/users/identity-mismatches');
        if (!res.ok) return;
        const { mismatches } = await res.json();
        if (!cancelled) setIdentityMismatch((mismatches ?? []).find(m => m.id === userId) || null);
      } catch {
        // Non-fatal: the page renders without the review panel.
      }
    })();
    (async () => {
      try {
        const res = await apiServerClient.fetch(`/admin/users/${userId}/stripe-names`);
        if (!res.ok) return;
        const body = await res.json();
        if (!cancelled) setStripeNames(body);
      } catch {
        // Non-fatal: the page renders without the name-check panel.
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const resolveIdentityMismatch = async (decision) => {
    setReviewSaving(true);
    try {
      const res = await apiServerClient.fetch(`/admin/users/${userId}/identity-review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to resolve the identity review.');
      }
      toast.success(decision === 'approve' ? 'Identity approved — user is now verified.' : 'Identity verification rejected.');
      setIdentityMismatch(null);
      refetch?.();
    } catch (err) {
      toast.error(err.message || 'Failed to resolve the identity review.');
    } finally {
      setReviewSaving(false);
    }
  };

  // Toggle a sole-trader store flag (verification / promotion). These appear on
  // the public Local Traders directory and will later gate behind subscription tiers.
  const toggleStoreFlag = async (updates, successMsg) => {
    if (!userId) return;
    setFlagSaving(true);
    try {
      const { error: updErr } = await supabase.from('profiles').update(updates).eq('id', userId);
      if (updErr) throw updErr;
      toast.success(successMsg);
      refetch?.();
    } catch (err) {
      toast.error(err.message || 'Failed to update store.');
    } finally {
      setFlagSaving(false);
    }
  };

  // Performs the action chosen in the confirmation modal. Suspend/reactivate/
  // delete go through the service-role /admin/users/:id/status endpoint, which
  // both flips profiles.is_active(/is_deleted) and actually bans the Supabase
  // auth user — a client-side profiles write alone (the old behaviour) never
  // blocked sign-in, it only hid the account from public listings.
  const handleConfirmAction = async () => {
    const type = actionModal.type;
    if (!type || !userId) return;
    try {
      if (type === 'suspend' || type === 'unsuspend' || type === 'delete') {
        const status = type === 'unsuspend' ? 'active' : type === 'suspend' ? 'suspended' : 'deleted';
        const res = await apiServerClient.fetch(`/admin/users/${userId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Failed to update account status.');
        }
        toast.success(
          type === 'suspend' ? 'Account suspended.'
            : type === 'unsuspend' ? 'Account reactivated.'
              : 'Account deleted.'
        );
        refetch?.();
      } else if (type === 'reset_password') {
        if (!user?.email) { toast.error('No email on file for this user.'); return; }
        const { error: resetErr } = await supabase.auth.resetPasswordForEmail(user.email, {
          redirectTo: `${window.location.origin}/reset-password`,
          captchaToken: resetCaptchaToken,
        });
        if (resetErr) throw resetErr;
        toast.success('Password reset email sent to the user.');
      }
    } catch (err) {
      toast.error(err.message || 'Action failed.');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
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
  const displayName = user.display_name || user.username || user.email || 'User';
  const initials = displayName.substring(0, 2).toUpperCase();

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-300 py-6 px-5 sm:px-8 md:px-12 xl:px-16 max-w-[90rem] mx-auto">
      <Helmet><title>{displayName} | User Details</title></Helmet>

      <AdminPageHeader
        icon={User}
        title={displayName}
        subtitle={`@${user.username || user.id}`}
        backTo="/admin/users"
      />

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
              <Badge variant="secondary" className="bg-secondary text-secondary-foreground">{user.community_type || user.user_type || 'collector'}</Badge>
              {isVerified(user.is_verified) && <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200">Verified</Badge>}
              {user.is_deleted && <Badge variant="destructive">Deleted</Badge>}
              {!user.is_deleted && user.is_active === false && <Badge variant="destructive">Suspended</Badge>}
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
              {user.is_sole_trader && (
                <>
                  <Button
                    variant={isVerified(user.is_verified) ? 'outline' : 'default'}
                    className="w-full justify-start"
                    disabled={flagSaving}
                    onClick={() => toggleStoreFlag(
                      isVerified(user.is_verified)
                        ? { is_verified: false }
                        : { is_verified: true, verification_status: 'approved' },
                      isVerified(user.is_verified) ? 'Business verification removed.' : 'Business verified.'
                    )}
                  >
                    <BadgeCheck className={`w-4 h-4 mr-2 ${isVerified(user.is_verified) ? 'text-blue-600' : ''}`} />
                    {isVerified(user.is_verified) ? 'Unverify Business' : 'Verify Business'}
                  </Button>
                  <Button
                    variant={user.is_featured_seller ? 'outline' : 'default'}
                    className="w-full justify-start"
                    disabled={flagSaving}
                    onClick={() => toggleStoreFlag(
                      { is_featured_seller: !user.is_featured_seller },
                      user.is_featured_seller ? 'Store removed from promoted.' : 'Store promoted to top.'
                    )}
                  >
                    <Sparkles className={`w-4 h-4 mr-2 ${user.is_featured_seller ? 'text-brand-red' : ''}`} />
                    {user.is_featured_seller ? 'Remove Promotion' : 'Promote Store'}
                  </Button>
                </>
              )}
              <Button
                variant={user.is_active !== false ? "outline" : "default"}
                className="w-full justify-start"
                disabled={user.is_deleted}
                onClick={() => openAction(user.is_active !== false ? 'suspend' : 'unsuspend')}
              >
                {user.is_active !== false ? (
                  <><ShieldAlert className="w-4 h-4 mr-2 text-destructive" /> Suspend Account</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4 mr-2" /> Reactivate Account</>
                )}
              </Button>
              <Button variant="outline" className="w-full justify-start" disabled={user.is_deleted} onClick={() => openAction('reset_password')}>
                <KeyRound className="w-4 h-4 mr-2" /> Send Password Reset
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                disabled={user.is_deleted}
                onClick={() => openAction('delete')}
              >
                <Trash2 className="w-4 h-4 mr-2" /> {user.is_deleted ? 'Account Deleted' : 'Delete Account'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
          {identityMismatch && (
            <Card className="border-amber-500/40 bg-amber-500/5 shadow-sm rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-serif flex items-center gap-2 text-amber-700 dark:text-amber-500">
                  <ShieldAlert className="w-5 h-5 shrink-0" /> ID Name Mismatch — Manual Review Required
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  This user passed Stripe Identity's document and selfie checks, but the name on their ID
                  doesn't match the name on their account. They have not been granted the Verified badge.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border bg-background p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Account Name</p>
                    <p className="font-bold text-foreground">{identityMismatch.display_name || '—'}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-background p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Name on ID Document</p>
                    <p className="font-bold text-foreground">{identityMismatch.legal_name || '—'}</p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 pt-1">
                  <Button disabled={reviewSaving} onClick={() => resolveIdentityMismatch('approve')}>
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Approve Verification
                  </Button>
                  <Button
                    variant="outline"
                    disabled={reviewSaving}
                    className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => resolveIdentityMismatch('reject')}
                  >
                    <ShieldAlert className="w-4 h-4 mr-2" /> Reject Verification
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {stripeNames && (stripeNames.names.idDocument || stripeNames.names.payoutAccount || stripeNames.names.billingCustomer) && (
            <Card className="border-border shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="bg-muted/30 border-b border-border">
                <CardTitle className="text-lg font-serif">Stripe Name Checks</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Match</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      { label: 'CardPop account', name: stripeNames.names.account, check: undefined },
                      { label: 'ID document (Stripe Identity)', name: stripeNames.names.idDocument, check: stripeNames.checks.idDocument },
                      { label: 'Payout account (Stripe Connect KYC)', name: stripeNames.names.payoutAccount, check: stripeNames.checks.payoutAccount },
                      { label: 'Billing customer (Stripe)', name: stripeNames.names.billingCustomer, check: stripeNames.checks.billingCustomer },
                    ].filter(row => row.name).map(row => (
                      <TableRow key={row.label}>
                        <TableCell className="text-sm text-muted-foreground">{row.label}</TableCell>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell className="text-right">
                          {row.check === undefined ? (
                            <span className="text-xs text-muted-foreground">baseline</span>
                          ) : row.check === null ? (
                            <span className="text-xs text-muted-foreground">n/a</span>
                          ) : row.check ? (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-200 text-[10px]">Match</Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-rose-500/15 text-rose-700 dark:text-rose-400 text-[10px]">
                              <ShieldAlert className="w-3 h-3 mr-1" /> Mismatch
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

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
        onConfirm={handleConfirmAction}
        confirmDisabled={
          (actionModal.type === 'reset_password' && TURNSTILE_ENABLED && !resetCaptchaToken)
          || (actionModal.type === 'delete' && deleteConfirmText.trim().toUpperCase() !== 'DELETE')
        }
        extraContent={
          actionModal.type === 'reset_password' && TURNSTILE_ENABLED ? (
            <Turnstile
              ref={resetTurnstileRef}
              onVerify={setResetCaptchaToken}
              onExpire={() => setResetCaptchaToken('')}
            />
          ) : actionModal.type === 'delete' ? (
            <div className="space-y-1.5">
              <label htmlFor="deleteConfirmText" className="text-xs font-semibold text-muted-foreground">
                Type DELETE to confirm
              </label>
              <Input
                id="deleteConfirmText"
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                autoComplete="off"
              />
            </div>
          ) : null
        }
      />
    </div>
  );
};

export default UserDetailPage;
