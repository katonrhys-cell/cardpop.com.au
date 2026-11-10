import React from 'react';
import { Mail, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext.jsx';
import { trackEvent } from '@/lib/analytics.js';
import {
  workspaceReferralUrl,
  WORKSPACE_REFERRAL_DISCLOSURE,
  WORKSPACE_REFERRAL_EVENT,
  WORKSPACE_REFERRAL_PROGRAM,
} from '@/utils/workspaceReferral.js';

const COPY = {
  sole_trader: {
    title: 'Look like a real shop: get a business email',
    body: 'Sell under hello@yourshop.com.au instead of a personal address. Google Workspace adds a shared calendar, Drive for your stock photos and Sheets for inventory.',
  },
  organiser: {
    title: 'Run your show on Google Workspace',
    body: 'A business email for vendor and ticket enquiries, shared Sheets for table bookings, and one calendar for your whole crew.',
  },
};

/**
 * Google Workspace referral card for business-minded members (sole traders,
 * event organisers). Never place it on a buying surface (home, shop,
 * marketplace, product, checkout). Renders nothing when the admin has switched
 * the referral off or the stored link isn't a valid https URL.
 */
const WorkspaceReferralCard = ({ placement = 'sole_trader', className = '' }) => {
  const { settings } = usePlatformSettings();
  const href = workspaceReferralUrl(settings);
  if (!href) return null;

  const copy = COPY[placement] || COPY.sole_trader;
  const onClick = () => trackEvent(WORKSPACE_REFERRAL_EVENT, { program: WORKSPACE_REFERRAL_PROGRAM, placement });

  return (
    <Card className={`shadow-sm ${className}`} data-testid="workspace-referral-card">
      <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Mail className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <p className="font-bold text-foreground">{copy.title}</p>
          <p className="text-sm text-muted-foreground">{copy.body}</p>
          <p className="text-xs text-muted-foreground/80">{WORKSPACE_REFERRAL_DISCLOSURE}</p>
        </div>
        <Button asChild variant="outline" className="rounded-xl font-bold shrink-0">
          <a href={href} target="_blank" rel="sponsored nofollow noopener noreferrer" onClick={onClick}>
            Try Google Workspace <ExternalLink className="w-4 h-4 ml-2" />
          </a>
        </Button>
      </CardContent>
    </Card>
  );
};

export default WorkspaceReferralCard;
