
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export const VerificationBadge = ({ is_verified, className = '' }) => {
  if (is_verified !== true && is_verified !== 'true') return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="secondary" className={`bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 flex items-center gap-1.5 px-2.5 py-0.5 shadow-sm ${className}`}>
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Verified</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-foreground text-background border-none font-medium">
          <p>This user's identity has been verified.</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
