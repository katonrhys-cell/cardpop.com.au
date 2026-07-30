import React, { useEffect, useRef, useState } from 'react';

import { ADSENSE_CLIENT, loadAdsenseScript } from '@/lib/adsense.js';

// Google AdSense in-article (fluid) ad unit. Renders the <ins> shell
// immediately and requests a fill once the loader script is ready — matches
// the standard AdSense in-article snippet, adapted for a React SPA where the
// script must load exactly once regardless of how many ad slots are on the
// page (main.jsx already loads it site-wide; lib/adsense.js dedupes).
//
// `className` is applied to the wrapper rather than the <ins> so that the slot's
// own spacing disappears along with it when there's no ad to show. When AdSense
// has no fill it sets data-ad-status="unfilled" but leaves the <ins> at the
// height it reserved, which shows up as a large blank gap mid-article — so we
// watch that attribute and collapse the whole slot.
const InArticleAd = ({ slot = '6597510546', className = '' }) => {
  const insRef = useRef(null);
  const [unfilled, setUnfilled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const ins = insRef.current;

    let observer;
    if (ins && typeof MutationObserver !== 'undefined') {
      const checkStatus = () => {
        if (ins.getAttribute('data-ad-status') === 'unfilled') setUnfilled(true);
      };
      observer = new MutationObserver(checkStatus);
      observer.observe(ins, { attributes: true, attributeFilter: ['data-ad-status'] });
      checkStatus();
    }

    loadAdsenseScript().then(() => {
      if (cancelled) return;
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {
        // AdSense not available (blocked by an ad blocker, offline, etc.) — non-critical.
      }
    });

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, []);

  return (
    <div className={unfilled ? 'hidden' : className} aria-hidden={unfilled || undefined}>
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: 'block', textAlign: 'center' }}
        data-ad-layout="in-article"
        data-ad-format="fluid"
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
      />
    </div>
  );
};

export default InArticleAd;
