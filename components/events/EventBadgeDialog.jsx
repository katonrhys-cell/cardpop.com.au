import React from 'react';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { eventBadgeSnippet } from '@/utils/eventBadge.js';

// "Listed on CardPop" badge for an organiser's own website — a link from
// their site to the event page (utils/eventBadge.js).
const EventBadgeDialog = ({ event, onClose }) => {
  const snippet = event ? eventBadgeSnippet(event) : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      toast.success('Badge code copied');
    } catch {
      toast.error('Couldn’t copy — select the code and copy it by hand.');
    }
  };

  return (
    <Dialog open={Boolean(event)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a CardPop badge to your website</DialogTitle>
          <DialogDescription>
            Paste this code on your event or ticket page. It shows the badge below and links
            visitors to your event on CardPop, which also helps your listing appear in Google.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center rounded-xl border border-border bg-muted/40 p-5">
          <img src="/badges/listed-on-cardpop.svg" alt="Listed on CardPop badge preview" width="200" height="56" />
        </div>
        <textarea
          readOnly
          value={snippet}
          onFocus={(e) => e.target.select()}
          aria-label="Badge HTML code"
          className="h-28 w-full resize-none rounded-xl border border-border bg-background p-3 font-mono text-xs"
        />
        <Button onClick={copy} className="w-full gap-2 rounded-xl font-bold">
          <Copy className="h-4 w-4" /> Copy code
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default EventBadgeDialog;
