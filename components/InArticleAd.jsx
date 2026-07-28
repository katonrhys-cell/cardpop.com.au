import React, { useEffect, useRef, useState } from 'react';

const ADSENSE_CLIENT = 'ca-pub-8195080361704709';
const ADSENSE_SCRIPT_SRC = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;

// Loads the adsbygoogle.js loader script at most once per page, no matter how
// many InArticleAd instances mount (multiple <script> tags would double-fetch
// and can trigger AdSense policy warnings for duplicate loaders).
let adsenseScriptPromise = null;
const loadAdsenseScript = () => {
  if (typeof document === 'undefined') return Promise.resolve();
  if (adsenseScriptPromise) return adsenseScriptPromise;
  const existing = document.querySelector(`script[src^="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]`);
  if (existing) {
    adsenseScriptPromise = Promise.resolve();
    return adsenseScriptPromise;
  }
  adsenseScriptPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = ADSENSE_SCRIPT_SRC;
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => resolve(), { once: true });
    document.head.appendChild(script);
  });
  return adsenseScriptPromise;
};

// Google AdSense in-article (fluid) ad unit. Renders the <ins> shell
// immediately and requests a fill once the loader script is ready — matches
// the standard AdSense in-article snippet, adapted for a React SPA where the
// script must load exactly once regardless of how many ad slots are on the page.
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
