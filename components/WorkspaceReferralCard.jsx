import React from 'react';
import { ExternalLink } from 'lucide-react';
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

const APPS_IMAGE = '/images/partners/google-workspace-apps.webp';
const ICON_IMAGE = '/images/partners/google-workspace-icon.webp';

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
    <Card className={`shadow-sm overflow-hidden ${className}`} data-testid="workspace-referral-card">
      {/* White panel behind the artwork so the app icons read in dark mode too. */}
      <div className="bg-white border-b border-border">
        <img
          src={APPS_IMAGE}
          alt="Google Workspace apps: Drive, Docs, Sheets, Slides, Meet, Calendar, Gmail, Chat and more"
          width={792}
          height={464}
          loading="lazy"
          decoding="async"
          className="w-full h-36 sm:h-44 object-contain"
        />
      </div>
      <CardContent className="p-6 space-y-4">
        <div className="space-y-1">
          <p className="font-bold text-foreground">{copy.title}</p>
          <p className="text-sm text-muted-foreground">{copy.body}</p>
        </div>
        <div className="space-y-2">
          <Button asChild variant="outline" className="w-full sm:w-auto rounded-xl font-bold">
            <a href={href} target="_blank" rel="sponsored nofollow noopener noreferrer" onClick={onClick}>
              <img src={ICON_IMAGE} alt="" aria-hidden="true" width={20} height={20} className="w-5 h-5 mr-2" />
              Try Google Workspace <ExternalLink className="w-4 h-4 ml-2" />
            </a>
          </Button>
          <p className="text-xs text-muted-foreground/80">{WORKSPACE_REFERRAL_DISCLOSURE}</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default WorkspaceReferralCard;
