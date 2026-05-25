import React from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const CardListingOptions = ({ values = {}, onChange }) => {
  const update = (key, value) => onChange?.({ ...values, [key]: value });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>List for Sale</Label>
        <Switch checked={!!values.forSale} onCheckedChange={v => update('forSale', v)} />
      </div>
      {values.forSale && (
        <div className="space-y-1">
          <Label>Asking Price (AUD)</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={values.price ?? ''}
            onChange={e => update('price', e.target.value)}
            placeholder="0.00"
          />
        </div>
      )}
      <div className="flex items-center justify-between">
        <Label>Open to Trades</Label>
        <Switch checked={!!values.forTrade} onCheckedChange={v => update('forTrade', v)} />
      </div>
      <div className="space-y-1">
        <Label>Condition</Label>
        <Select value={values.condition ?? ''} onValueChange={v => update('condition', v)}>
          <SelectTrigger><SelectValue placeholder="Select condition" /></SelectTrigger>
          <SelectContent>
            {['Mint', 'Near Mint', 'Excellent', 'Good', 'Played', 'Poor'].map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default CardListingOptions;
