import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '@/lib/analytics.js';

// Sends a GA4 page_view for the initial route and every client-side
// navigation. gtag's automatic page_view is disabled (lib/analytics.js) so
// this component is the single source of page_view events.
//
// Pages are lazy-loaded and set their <title> via Helmet only after their
// chunk mounts, so firing immediately on route change would stamp the
// *previous* page's title on the event. Instead, wait for the <title> element
// to mutate (the destination page's Helmet applying) with a 1.5s fallback for
// navigations that keep the same title. A follow-up navigation before either
// fires flushes the pending event immediately, so no route ever loses its
// page_view.
const AnalyticsPageViews = () => {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname + location.search;
    const titleEl = document.querySelector('title');

    let sent = false;
    let observer = null;
    let timer = null;
    const send = () => {
      if (sent) return;
      sent = true;
      if (observer) observer.disconnect();
      if (timer) clearTimeout(timer);
      trackPageView(path);
    };

    if (titleEl) {
      observer = new MutationObserver(send);
      observer.observe(titleEl, { childList: true });
      timer = setTimeout(send, 1500);
    } else {
      send();
    }

    // Effect cleanup runs right before the next route's effect: flush the
    // pending page_view so rapid navigations are still counted, in order.
    return send;
  }, [location.pathname, location.search]);

  return null;
};

export default AnalyticsPageViews;
