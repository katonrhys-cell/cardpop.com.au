import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, ShieldAlert, CheckCircle, Loader2 } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { toast } from 'sonner';

const ModerationPanel = ({ listing, onUpdate }) => {
  const [notes, setNotes] = useState(listing?.moderationNotes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSaveNotes = async () => {
    if (!listing?.id) return;
    setIsSubmitting(true);
    try {
      const updated = await pb.collection('officialCatalog').update(listing.id, {
        moderationNotes: notes
      }, { $autoCancel: false });
      
      toast.success('Moderation notes updated successfully');
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
        updatedData = { stockQuantity: 0, moderationNotes: `[SUSPENDED] ${notes}` };
        msg = 'Listing suspended (stock set to 0)';
      } else if (action === 'clear') {
        updatedData = { moderationNotes: '' };
        setNotes('');
        msg = 'Moderation notes cleared';
      }

      const updated = await pb.collection('officialCatalog').update(listing.id, updatedData, { $autoCancel: false });
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
        <label className="text-sm font-medium">Moderation Notes / Audit Trail</label>
        <Textarea 
          placeholder="Add internal notes, violation details, or review comments..."
          className="min-h-[150px] resize-none bg-background text-foreground"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <div className="flex gap-3 justify-end mt-4">
          <Button 
            variant="outline" 
            onClick={() => handleQuickAction('clear')}
            disabled={isSubmitting || !notes}
          >
            Clear Notes
          </Button>
          <Button 
            onClick={handleSaveNotes}
            disabled={isSubmitting || notes === listing?.moderationNotes}
            className="gap-2"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Save Notes
          </Button>
        </div>
      </div>

      <div className="border-t border-border pt-6">
        <h4 className="text-sm font-medium mb-3">Quick Actions</h4>
        <div className="flex flex-wrap gap-3">
          <Button 
            variant="destructive" 
            onClick={() => handleQuickAction('suspend')}
            disabled={isSubmitting || listing?.stockQuantity === 0}
            className="gap-2"
          >
            <AlertCircle className="w-4 h-4" />
            Suspend (Set Out of Stock)
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ModerationPanel;