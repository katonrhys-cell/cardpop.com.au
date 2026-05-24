import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

const ProductFormFields = ({ showRCBadge = true, onShowRCBadgeChange, gradeText = '', onGradeTextChange }) => {
  return (
    <div className="space-y-6 bg-card p-6 rounded-2xl border border-border shadow-sm">
      <h3 className="text-lg font-bold text-foreground mb-4">Card Badges & Grading</h3>
      
      <div className="flex flex-row items-center justify-between rounded-xl border border-border/50 p-4 bg-muted/30">
        <div className="space-y-1">
          <Label className="text-base font-bold text-foreground cursor-pointer" onClick={() => onShowRCBadgeChange(!showRCBadge)}>
            Show RC Badge
          </Label>
          <p className="text-sm text-muted-foreground">
            Display the Rookie Card (RC) badge on the top-left of the product image.
          </p>
        </div>
        <Switch
          checked={showRCBadge}
          onCheckedChange={onShowRCBadgeChange}
          aria-label="Toggle RC Badge"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="gradeText" className="text-base font-bold text-foreground">
          Grade Text
        </Label>
        <Input
          id="gradeText"
          placeholder="e.g., PSA 10, BGS 9.5, SGC 8"
          value={gradeText}
          onChange={(e) => onGradeTextChange(e.target.value)}
          className="text-foreground bg-background h-12 rounded-xl"
        />
        <p className="text-sm text-muted-foreground">
          Enter the card's grade to display a grade badge on the top-right. Leave empty if raw/ungraded.
        </p>
      </div>
    </div>
  );
};

export default ProductFormFields;