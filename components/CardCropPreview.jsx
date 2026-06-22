import React from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, CheckCircle2, SlidersHorizontal } from 'lucide-react';

/**
 * Original-vs-cropped confirmation panel for the card auto-crop feature.
 * Shown after detection succeeds; the user chooses to apply, fine-tune the
 * corners, or keep the original.
 */
const CardCropPreview = ({ originalUrl, croppedUrl, onApply, onAdjust, onDismiss }) => (
  <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3 animate-in fade-in">
    <p className="text-xs font-semibold text-primary mb-2 flex items-center gap-1.5">
      <Sparkles className="w-3.5 h-3.5" />
      Card detected — straightened &amp; cropped to size
    </p>
    <div className="grid grid-cols-2 gap-2 mb-3">
      <div>
        <p className="text-[10px] text-muted-foreground mb-1">Original</p>
        <img src={originalUrl} alt="Original" className="w-full aspect-[5/7] object-cover rounded-lg border border-border" />
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground mb-1">Cropped</p>
        <img src={croppedUrl} alt="Cropped card" className="w-full aspect-[5/7] object-cover rounded-lg border border-primary/40" />
      </div>
    </div>
    <div className="flex gap-2">
      <Button type="button" size="sm" onClick={onApply} className="flex-1 font-semibold gap-1.5">
        <CheckCircle2 className="w-4 h-4" /> Use cropped
      </Button>
      {onAdjust && (
        <Button type="button" size="sm" variant="outline" onClick={onAdjust} className="flex-1 gap-1.5">
          <SlidersHorizontal className="w-3.5 h-3.5" /> Adjust
        </Button>
      )}
      <Button type="button" size="sm" variant="outline" onClick={onDismiss} className="flex-1">
        Keep original
      </Button>
    </div>
  </div>
);

export default CardCropPreview;
