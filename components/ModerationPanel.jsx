import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, ShieldAlert, CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import { toast } from 'sonner';

const ModerationPanel = ({ listing, onUpdate }) => {
  const [notes, setNotes] = useState(listing?.flag_reason || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Moderation acts on the `listings` row: `flagged`/`flag_reason` hold the
  // moderation state, and archiving removes the listing from the marketplace.
  const persist = async (updatedData) => {
    const { data: updated, error } = await supabase
      .from('listings')
      .update(updatedData)
      .eq('id', listing.id)
      .select('*, vault_item:vault_items(card_name, set_name, card_image, card_images, category_id, condition, grade)')
      .single();
    if (error || !updated) throw (error || new Error('No row updated'));
    return updated;
  };

  const handleSaveNotes = async () => {
    if (!listing?.id) return;
    setIsSubmitting(true);
    try {
      const updated = await persist({ flagged: true, flag_reason: notes || null });
      toast.success('Listing flagged for moderation');
      if (onUpdate) onUpdate(updated);
    } catch (error) {
      console.error('Failed to update notes:', error);
      toast.error('Failed to update moderation notes');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickAction = async (action) => {
    if (!listing?.id) return;
    setIsSubmitting(true);

    try {
      let updatedData = {};
      let msg = '';

      if (action === 'suspend') {
        updatedData = { status: 'archived' };
        msg = 'Listing suspended (removed from marketplace)';
      } else if (action === 'clear') {
        updatedData = { flagged: false, flag_reason: null };
        setNotes('');
        msg = 'Moderation flag cleared';
      }

      const updated = await persist(updatedData);
      toast.success(msg);
      if (onUpdate) onUpdate(updated);
    } catch (error) {
      console.error('Quick action failed:', error);
      toast.error('Action failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex items-start gap-4">
        <ShieldAlert className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
        <div>
          <h4 className="text-sm font-semibold text-destructive">Admin Moderation Zone</h4>
          <p className="text-sm text-muted-foreground mt-1">
            Notes entered here are visible only to admins and moderators. Use this to flag items or record policy violations.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium">Flag Reason / Audit Trail</label>
        <Textarea
          placeholder="Add violation details or review comments — saving flags the listing..."
          className="min-h-[150px] resize-none bg-background text-foreground"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <div className="flex gap-3 justify-end mt-4">
          <Button
            variant="outline"
            onClick={() => handleQuickAction('clear')}
            disabled={isSubmitting || (!listing?.flagged && !notes)}
          >
            Clear Flag
          </Button>
          <Button
            onClick={handleSaveNotes}
            disabled={isSubmitting || (listing?.flagged && notes === (listing?.flag_reason || ''))}
            className="gap-2"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Flag Listing
          </Button>
        </div>
      </div>

      <div className="border-t border-border pt-6">
        <h4 className="text-sm font-medium mb-3">Quick Actions</h4>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="destructive"
            onClick={() => handleQuickAction('suspend')}
            disabled={isSubmitting || listing?.status === 'archived'}
            className="gap-2"
          >
            <AlertCircle className="w-4 h-4" />
            Suspend (remove from marketplace)
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ModerationPanel;