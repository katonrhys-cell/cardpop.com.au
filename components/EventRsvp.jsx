import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Store, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import {
  RSVP_ROLES,
  emptyCounts,
  fetchRsvpCounts,
  fetchMyRsvps,
  setRsvp as setRsvpRemote,
  removeRsvp as removeRsvpRemote,
} from '@/lib/eventRsvp.js';

// Shared RSVP control: shows the live attendee / vendor split for an event and
// lets a signed-in user RSVP as a buyer (attendee) or a vendor.
//
// Props:
//   event   – event record (needs `id`)
//   variant – 'card' (compact) | 'detail' (full width, default)
const EventRsvp = ({ event, variant = 'detail', className = '' }) => {
  const eventId = event?.id;
  const { currentUser, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [counts, setCounts] = useState(emptyCounts);
  const [myRole, setMyRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null); // 'buyer' | 'vendor' | 'cancel'

  const load = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const [countMap, mineMap] = await Promise.all([
        fetchRsvpCounts([eventId]),
        isAuthenticated && currentUser?.id
          ? fetchMyRsvps(currentUser.id, [eventId])
          : Promise.resolve({}),
      ]);
      setCounts(countMap[eventId] || emptyCounts());
      setMyRole(mineMap[eventId] || null);
    } catch (err) {
      console.error('Error loading RSVP data:', err);
    } finally {
      setLoading(false);
    }
  }, [eventId, isAuthenticated, currentUser?.id]);

  useEffect(() => { load(); }, [load]);

  const handleRsvp = async (role) => {
    if (!isAuthenticated) {
      toast('Sign in to RSVP', { description: 'Create a free account to register for this event.' });
      navigate('/login', { state: { from: window.location.pathname } });
      return;
    }
    if (saving) return;
    if (myRole === role) { handleCancel(); return; }

    const prevRole = myRole;
    const prevCounts = counts;
    // Optimistic update.
    const next = { ...counts };
    if (prevRole) next[prevRole] = Math.max(0, next[prevRole] - 1);
    next[role] = next[role] + 1;
    setCounts(next);
    setMyRole(role);
    setSaving(role);
    try {
      await setRsvpRemote(eventId, currentUser.id, role);
      toast.success(
        prevRole
          ? `Updated — you're going as a ${RSVP_ROLES[role].label.toLowerCase()}`
          : `You're going as a ${RSVP_ROLES[role].label.toLowerCase()}!`,
      );
    } catch (err) {
      console.error('Error saving RSVP:', err);
      setCounts(prevCounts);
      setMyRole(prevRole);
      toast.error('Could not save your RSVP. Please try again.');
    } finally {
      setSaving(null);
    }
  };

  const handleCancel = async () => {
    if (!myRole || saving) return;
    const prevRole = myRole;
    const prevCounts = counts;
    const next = { ...counts };
    next[prevRole] = Math.max(0, next[prevRole] - 1);
    setCounts(next);
    setMyRole(null);
    setSaving('cancel');
    try {
      await removeRsvpRemote(eventId, currentUser.id);
      toast('RSVP cancelled');
    } catch (err) {
      console.error('Error cancelling RSVP:', err);
      setCounts(prevCounts);
      setMyRole(prevRole);
      toast.error('Could not cancel your RSVP. Please try again.');
    } finally {
      setSaving(null);
    }
  };

  const compact = variant === 'card';

  // Attendee / vendor split — shown above the RSVP control.
  const stats = (
    <div className={`flex items-center justify-between gap-2 text-sm ${compact ? 'text-muted-foreground' : ''}`}>
      <span className="flex items-center gap-1.5 font-medium">
        <Users className={compact ? 'w-4 h-4' : 'w-4 h-4 text-primary'} />
        <span className="font-bold text-foreground tabular-nums">{counts.buyer}</span>
        {RSVP_ROLES.buyer.plural}
      </span>
      <span className="flex items-center gap-1.5 font-medium">
        <Store className={compact ? 'w-4 h-4' : 'w-4 h-4 text-primary'} />
        <span className="font-bold text-foreground tabular-nums">{counts.vendor}</span>
        {RSVP_ROLES.vendor.plural}
      </span>
    </div>
  );

  const buyerActive = myRole === 'buyer';
  const vendorActive = myRole === 'vendor';

  const rsvpButtons = (
    <div className="grid grid-cols-2 gap-2 w-full">
      <Button
        variant={buyerActive ? 'default' : 'outline'}
        size={compact ? 'sm' : 'default'}
        className="font-semibold gap-1.5"
        disabled={loading || saving === 'vendor'}
        onClick={(e) => { e.stopPropagation(); handleRsvp('buyer'); }}
      >
        {saving === 'buyer' ? <Loader2 className="w-4 h-4 animate-spin" />
          : buyerActive ? <Check className="w-4 h-4" /> : <Users className="w-4 h-4" />}
        {buyerActive ? 'Attending' : 'Attend'}
      </Button>
      <Button
        variant={vendorActive ? 'default' : 'outline'}
        size={compact ? 'sm' : 'default'}
        className="font-semibold gap-1.5"
        disabled={loading || saving === 'buyer'}
        onClick={(e) => { e.stopPropagation(); handleRsvp('vendor'); }}
      >
        {saving === 'vendor' ? <Loader2 className="w-4 h-4 animate-spin" />
          : vendorActive ? <Check className="w-4 h-4" /> : <Store className="w-4 h-4" />}
        {vendorActive ? 'Selling' : 'Sell as Vendor'}
      </Button>
    </div>
  );

  return (
    <div className={`flex flex-col gap-2.5 w-full ${className}`}>
      {stats}
      {!compact && (
        <p className="text-xs text-muted-foreground -mt-1">
          {myRole
            ? `You're going as a ${RSVP_ROLES[myRole].label.toLowerCase()}.`
            : 'RSVP to this event — are you coming to buy or to sell?'}
        </p>
      )}
      {rsvpButtons}
      {myRole && (
        <Button
          variant="ghost"
          size="sm"
          className="self-start h-auto py-1 px-2 text-xs text-muted-foreground hover:text-destructive gap-1"
          disabled={!!saving}
          onClick={(e) => { e.stopPropagation(); handleCancel(); }}
        >
          {saving === 'cancel' ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
          Cancel RSVP
        </Button>
      )}
    </div>
  );
};

export default EventRsvp;
