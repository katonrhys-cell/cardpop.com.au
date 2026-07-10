import React, { createContext, useContext, useEffect, useState } from 'react';
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
  enable_trading: true,
  enable_blog: true,
  max_images_per_listing: 10,
  listing_approval_required: false,
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

  return (
    <PlatformSettingsContext.Provider value={{ settings, loading }}>
      {children}
    </PlatformSettingsContext.Provider>
  );
};

export const usePlatformSettings = () => useContext(PlatformSettingsContext);

export { DEFAULTS as PLATFORM_SETTINGS_DEFAULTS };
