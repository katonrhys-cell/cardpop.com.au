import React from 'react';
import { useLocation } from 'react-router-dom';
import { Wrench } from 'lucide-react';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';

// Paths that stay reachable during maintenance so an admin can still sign in
// and turn it back off (and so auth flows don't dead-end). Everything else is
// replaced by the maintenance screen for non-admin visitors.
const ALLOWED_PREFIXES = ['/login', '/logout', '/admin', '/reset-password', '/forgot-password'];

const MaintenanceScreen = () => (
  <div className="flex-grow flex items-center justify-center px-6 py-24 text-center">
    <div className="max-w-md space-y-4">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Wrench className="h-7 w-7 text-muted-foreground" />
      </div>
      <h1 className="text-2xl font-bold text-foreground">We'll be right back</h1>
      <p className="text-muted-foreground">
        CardPop is down for scheduled maintenance. Thanks for your patience — please check back shortly.
      </p>
    </div>
  </div>
);

// Site-wide maintenance switch. When `maintenance_mode` is on, non-admin
// visitors see the maintenance screen on every page except the allow-listed
// auth/admin paths. Admins pass through untouched so they can keep working and
// flip the switch back off.
const MaintenanceGate = ({ children }) => {
  const { settings } = usePlatformSettings();
  const { isAdmin } = useAuth();
  const location = useLocation();

  const onAllowedPath = ALLOWED_PREFIXES.some((p) => location.pathname.startsWith(p));

  if (settings?.maintenance_mode === true && !isAdmin && !onAllowedPath) {
    return <MaintenanceScreen />;
  }
  return children;
};

export default MaintenanceGate;
