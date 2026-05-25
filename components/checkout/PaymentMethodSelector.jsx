import React from 'react';
import { CreditCard, Wallet } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const METHODS = [
  { id: 'card', label: 'Credit / Debit Card', icon: CreditCard },
  { id: 'wallet', label: 'CardPop Wallet', icon: Wallet },
];

const PaymentMethodSelector = ({ value, onChange }) => {
  return (
    <RadioGroup value={value} onValueChange={onChange} className="space-y-2">
      {METHODS.map(({ id, label, icon: Icon }) => (
        <div
          key={id}
          className="flex items-center gap-3 border border-border rounded-xl p-3 cursor-pointer hover:bg-muted/50 transition-colors"
        >
          <RadioGroupItem value={id} id={`pay-${id}`} />
          <Label htmlFor={`pay-${id}`} className="flex items-center gap-2 cursor-pointer flex-1">
            <Icon className="h-4 w-4 text-muted-foreground" />
            {label}
          </Label>
        </div>
      ))}
    </RadioGroup>
  );
};

export default PaymentMethodSelector;
