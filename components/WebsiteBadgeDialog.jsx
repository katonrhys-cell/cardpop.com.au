import React from 'react';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BADGES, BADGE_WIDTH, BADGE_HEIGHT } from '@/utils/websiteBadge.js';

// Shared "copy this badge onto your website" dialog (utils/websiteBadge.js).
// `preview` ({ src, alt, width, height }) overrides the static badge image —
// the price widget passes its live SVG (utils/priceWidget.js).
const WebsiteBadgeDialog = ({ open, onClose, kind, snippet, title, description, preview }) => {
  const badge = preview || (BADGES[kind]
    ? { src: BADGES[kind].path, alt: `${BADGES[kind].alt} (preview)`, width: BADGE_WIDTH, height: BADGE_HEIGHT }
    : null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      toast.success('Badge code copied');
    } catch {
      toast.error('Couldn’t copy — select the code and copy it by hand.');
    }
  };

  return (
    <Dialog open={Boolean(open)} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {badge && (
          <div className="flex justify-center rounded-xl border border-border bg-muted/40 p-5">
            <img src={badge.src} alt={badge.alt} width={badge.width} height={badge.height} className="max-w-full h-auto" />
          </div>
        )}
        <textarea
          readOnly
          value={snippet || ''}
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

export default WebsiteBadgeDialog;
