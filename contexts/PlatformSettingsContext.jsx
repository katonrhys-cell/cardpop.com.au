import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import apiServerClient from '@/lib/apiServerClient.js';

// Runtime platform settings (feature flags, maintenance switch, listing-form
// limits) read from the public settings endpoint. Defaults are FAIL-OPEN:
// everything enabled and maintenance off, so if the fetch is slow or fails the
// site behaves normally rather than hiding sections or falsely showing a
// maintenance page. Values mirror the whitelist in src/routes/settings.js.
const DEFAULTS = {
  site_name: 'CardPop',
  maintenance_mode: false,
  enable_marketplace: true,
  // The propose-trade flow exists (ProposeTradeModal → trades table), but
  // launching trading is an admin decision — flip the flag in Admin →
  // Platform Settings when ready (mirrors src/routes/settings.js). Fail-closed
  // here also avoids flashing trade UI while the settings fetch is in flight.
  enable_trading: false,
  enable_blog: true,
  max_images_per_listing: 10,
  listing_approval_required: false,
  marketplace_identity_threshold_aud: 500,
  free_shipping_threshold_aud: 100,
  default_shipping_rate_aud: 15,
};

const PlatformSettingsContext = createContext({ settings: DEFAULTS, loading: true });

export const PlatformSettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiServerClient.fetch('/settings/public')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!cancelled && data && typeof data === 'object') setSettings({ ...DEFAULTS, ...data }); })
      .catch(() => { /* keep fail-open defaults */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Memoized so provider re-renders don't hand consumers a fresh reference.
  const value = useMemo(() => ({ settings, loading }), [settings, loading]);

  return (
    <PlatformSettingsContext.Provider value={value}>
      {children}
    </PlatformSettingsContext.Provider>
  );
};

export const usePlatformSettings = () => useContext(PlatformSettingsContext);

export { DEFAULTS as PLATFORM_SETTINGS_DEFAULTS };
