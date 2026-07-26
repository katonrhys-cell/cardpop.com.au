import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext.jsx';
import PageLoader from '@/components/PageLoader.jsx';

// Gates a route behind a platform feature flag. Renders its children when the
// flag is on and redirects home when it's off. Waits for the settings fetch
// before deciding: some flags (enable_trading) now default OFF, so redirecting
// against the pre-fetch defaults would bounce a deep link the admin has
// actually enabled. The redirect is permanent (replace), so it must only ever
// happen against resolved settings.
const FeatureRoute = ({ flag, children }) => {
  const { settings, loading } = usePlatformSettings();
  if (settings?.[flag] === false) {
    if (loading) return <PageLoader />;
    return <Navigate to="/" replace />;
  }
  return children;
};

export default FeatureRoute;
