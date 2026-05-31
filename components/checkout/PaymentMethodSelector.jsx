import React from 'react';
import { CreditCard, Wallet } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';

const PaymentMethodSelector = ({ value, onChange }) => {
  return (
    <RadioGroup value={value} onValueChange={onChange} className="space-y-2">
      <div className="flex items-center gap-3 border border-border rounded-xl p-3 cursor-pointer hover:bg-muted/50 transition-colors">
        <RadioGroupItem value="card" id="pay-card" />
        <Label htmlFor="pay-card" className="flex items-center gap-2 cursor-pointer flex-1">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          Credit / Debit Card
        </Label>
      </div>
      <div className="flex items-center gap-3 border border-border rounded-xl p-3 opacity-50 cursor-not-allowed">
        <RadioGroupItem value="wallet" id="pay-wallet" disabled />
        <Label htmlFor="pay-wallet" className="flex items-center gap-2 flex-1 cursor-not-allowed">
          <Wallet className="h-4 w-4 text-muted-foreground" />
          CardPop Wallet
        </Label>
        <Badge variant="outline" className="text-xs">Coming soon</Badge>
      </div>
    </RadioGroup>
  );
};

export default PaymentMethodSelector;
