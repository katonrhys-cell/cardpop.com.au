import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { scheduleBadgeLoad } from '@/lib/googleCustomerReviews.js';

// Starts the Google Customer Reviews badge on the first page of a visit that
// may show it (not checkout, sign-in or admin) — a visitor who lands on /login
// still gets it once they browse on.
const GoogleReviewsBadgeLoader = () => {
  const { pathname } = useLocation();
  useEffect(() => { scheduleBadgeLoad(pathname); }, [pathname]);
  return null;
};

export default GoogleReviewsBadgeLoader;
