import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const AU_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];

const ShippingAddressForm = ({ values = {}, onChange }) => {
  const update = (key, value) => onChange?.({ ...values, [key]: value });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>First Name</Label>
          <Input value={values.firstName ?? ''} onChange={e => update('firstName', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Last Name</Label>
          <Input value={values.lastName ?? ''} onChange={e => update('lastName', e.target.value)} />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Street Address</Label>
        <Input value={values.address ?? ''} onChange={e => update('address', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Suburb</Label>
          <Input value={values.suburb ?? ''} onChange={e => update('suburb', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>State</Label>
          <Select value={values.state ?? ''} onValueChange={v => update('state', v)}>
            <SelectTrigger><SelectValue placeholder="State" /></SelectTrigger>
            <SelectContent>
              {AU_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <Label>Postcode</Label>
        <Input value={values.postcode ?? ''} onChange={e => update('postcode', e.target.value)} maxLength={4} className="w-32" />
      </div>
    </div>
  );
};

export default ShippingAddressForm;
