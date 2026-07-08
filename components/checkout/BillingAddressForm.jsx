import React from 'react';
import { CheckCircle2, Building2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import ShippingAddressForm from './ShippingAddressForm.jsx';
import { isValidAbn, normalizeAbn, formatAbn } from '@/utils/abn.js';

const BillingAddressForm = ({ values = {}, onChange, shippingAddress, sameAsShipping, onSameAsShippingChange }) => {
  const handleToggle = (checked) => {
    onSameAsShippingChange?.(checked);
    // Preserve any business details already entered when copying the shipping address.
    if (checked) onChange?.({ ...(shippingAddress ?? {}), isBusiness: values.isBusiness, businessName: values.businessName, abn: values.abn });
  };

  const update = (key, value) => onChange?.({ ...values, [key]: value });

  const abnDigits = normalizeAbn(values.abn);
  const abnValid = isValidAbn(values.abn);
  const showAbnError = values.isBusiness && abnDigits.length > 0 && !abnValid;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Checkbox id="same-shipping" checked={sameAsShipping} onCheckedChange={handleToggle} />
        <Label htmlFor="same-shipping" className="cursor-pointer">Same as shipping address</Label>
      </div>
      {!sameAsShipping && <ShippingAddressForm values={values} onChange={onChange} />}

      {/* Business / ABN — optional. When ticked, the ABN is attached to the
          buyer's Stripe tax invoice so businesses can claim GST. */}
      <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <Checkbox
            id="is-business"
            className="mt-0.5"
            checked={!!values.isBusiness}
            onCheckedChange={(checked) => update('isBusiness', !!checked)}
          />
          <span className="space-y-0.5">
            <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Building2 className="h-4 w-4 text-primary" /> This is a business purchase
            </span>
            <span className="block text-xs text-muted-foreground">
              Add your business name and ABN to receive a valid tax invoice.
            </span>
          </span>
        </label>

        {values.isBusiness && (
          <div className="space-y-4 pt-1">
            <div className="space-y-1">
              <Label htmlFor="business-name">Business name</Label>
              <Input
                id="business-name"
                value={values.businessName ?? ''}
                onChange={(e) => update('businessName', e.target.value)}
                placeholder="Registered business or trading name"
                autoComplete="organization"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="abn">ABN</Label>
              <Input
                id="abn"
                inputMode="numeric"
                value={values.abn ?? ''}
                onChange={(e) => update('abn', e.target.value)}
                onBlur={() => { if (abnValid) update('abn', formatAbn(values.abn)); }}
                placeholder="11 digit Australian Business Number"
                aria-invalid={showAbnError}
                className={showAbnError ? 'border-destructive focus-visible:ring-destructive' : undefined}
              />
              {showAbnError ? (
                <p className="text-xs text-destructive">Enter a valid 11-digit ABN.</p>
              ) : abnValid ? (
                <p className="flex items-center gap-1.5 text-xs text-green-600">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Valid ABN
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">We'll add this to your tax invoice.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BillingAddressForm;
