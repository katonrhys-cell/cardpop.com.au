import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import ShippingAddressForm from './ShippingAddressForm.jsx';

const BillingAddressForm = ({ values = {}, onChange, shippingAddress, sameAsShipping, onSameAsShippingChange }) => {
  const handleToggle = (checked) => {
    onSameAsShippingChange?.(checked);
    if (checked) onChange?.(shippingAddress ?? {});
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Checkbox id="same-shipping" checked={sameAsShipping} onCheckedChange={handleToggle} />
        <Label htmlFor="same-shipping" className="cursor-pointer">Same as shipping address</Label>
      </div>
      {!sameAsShipping && <ShippingAddressForm values={values} onChange={onChange} />}
    </div>
  );
};

export default BillingAddressForm;
