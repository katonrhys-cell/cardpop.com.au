import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import GradingVerificationBadge from '@/components/GradingVerificationBadge.jsx';

const GradingInput = ({
  gradingNumber = '',
  company = 'psa',
  onGradingNumberChange,
  onCompanyChange,
  placeholder = 'e.g., 12345678',
  hideCompanySelect = false,
  disabled = false,
}) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Label htmlFor="grading-number">Grading Certificate Number (Optional)</Label>
          <Input
            id="grading-number"
            type="text"
            value={gradingNumber}
            onChange={(e) => onGradingNumberChange?.(e.target.value)}
            placeholder={placeholder}
            className="bg-background border-border mt-1"
            disabled={disabled}
          />
        </div>

        {!hideCompanySelect && (
          <div>
            <Label htmlFor="grading-company">Company</Label>
            <Select value={company} onValueChange={onCompanyChange} disabled={disabled}>
              <SelectTrigger id="grading-company" className="bg-background border-border w-[120px] mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="psa">PSA</SelectItem>
                <SelectItem value="beckett">Beckett</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {gradingNumber && <GradingVerificationBadge gradingNumber={gradingNumber} company={company} />}
    </div>
  );
};

export default GradingInput;
