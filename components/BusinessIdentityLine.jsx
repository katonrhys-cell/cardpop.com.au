import React from 'react';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext.jsx';
import { BUSINESS_IDENTITY_KEY, businessIdentityLine, businessIdentityShort } from '@/utils/businessIdentity.js';

/**
 * Who operates CardPop: "… is operated by <legal name> (ABN …)." — from the
 * name and ABN an admin enters at Admin → Invoices → Invoice details, published
 * through the public settings (utils/businessIdentity.js). Renders nothing
 * until a valid ABN has been entered, so no page ever shows a blank "ABN:".
 */
const BusinessIdentityLine = ({ short = false, as: Tag = 'p', className = '' }) => {
  const { settings } = usePlatformSettings();
  const identity = settings?.[BUSINESS_IDENTITY_KEY];
  const text = short ? businessIdentityShort(identity) : businessIdentityLine(identity);
  if (!text) return null;
  return <Tag className={className} data-testid="business-identity">{text}</Tag>;
};

export default BusinessIdentityLine;
