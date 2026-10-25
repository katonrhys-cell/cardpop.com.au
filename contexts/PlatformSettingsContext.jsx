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

// The last settings this browser fetched, used as the starting point on the
// next load. Starting from DEFAULTS every time meant nav/footer items an admin
// had switched (blog/marketplace off, trading on) appeared and then vanished
// — or popped in — once the fetch landed, on every page load. The fetch still
// runs and wins; this only makes a returning visitor's first frame right.
const CACHE_KEY = 'cardpop_platform_settings';
const readCachedSettings = () => {
  try {
    const cached = JSON.parse(window.localStorage.getItem(CACHE_KEY) || 'null');
    // maintenance_mode stays fail-open: a cached "on" would put the
    // maintenance screen in front of everyone returning after it ended.
    if (cached && typeof cached === 'object') return { ...DEFAULTS, ...cached, maintenance_mode: false };
  } catch { /* storage blocked or corrupt — fall back to the defaults */ }
  return DEFAULTS;
};

const PlatformSettingsContext = createContext({ settings: DEFAULTS, loading: true });

export const PlatformSettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(readCachedSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiServerClient.fetch('/settings/public')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data || typeof data !== 'object') return;
        setSettings({ ...DEFAULTS, ...data });
        try { window.localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* best-effort */ }
      })
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
