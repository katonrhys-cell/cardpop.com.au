import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { scheduleAdsenseLoad } from '@/lib/adsense.js';

// main.jsx loads AdSense for the page a visitor lands on, but skips screens
// without publisher content (login, account, checkout…). This picks it up on
// the first client-side navigation to a page that may carry ads.
const AdsenseRouteLoader = () => {
  const { pathname } = useLocation();
  useEffect(() => { scheduleAdsenseLoad(pathname); }, [pathname]);
  return null;
};

export default AdsenseRouteLoader;
