import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext.jsx';

// Gates a route behind a platform feature flag. Renders its children when the
// flag is on (the default), and redirects home when an admin has explicitly
// turned the section off. Uses `=== false` so the fail-open default and the
// brief pre-fetch window never hide a section — only a stored `false` does.
const FeatureRoute = ({ flag, children }) => {
  const { settings } = usePlatformSettings();
  if (settings?.[flag] === false) return <Navigate to="/" replace />;
  return children;
};

export default FeatureRoute;
