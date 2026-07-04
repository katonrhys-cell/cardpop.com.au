import React, { Suspense, lazy, useEffect, useState } from 'react';

// The sonner Toaster (+ next-themes) is ~15 kB gzip and renders nothing at first
// paint — no toast exists yet. Importing it eagerly from App.jsx put it on the
// critical path where PageSpeed counted it against TBT/unused JS. We instead
// mount it once the browser is idle (or on the first interaction, whichever comes
// first). sonner keeps queued toasts in a global store, so any toast fired in the
// brief pre-mount window still renders as soon as the Toaster attaches.
const Toaster = lazy(() => import('@/components/ui/sonner').then(m => ({ default: m.Toaster })));

const ToasterLazy = (props) => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let idleId;
    const activate = () => setReady(true);

    if ('requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(activate, { timeout: 2000 });
    } else {
      idleId = window.setTimeout(activate, 1500);
    }

    // Fast-path: a real interaction almost always precedes the first toast.
    const events = ['pointerdown', 'keydown', 'touchstart'];
    const onInteract = () => activate();
    for (const evt of events) window.addEventListener(evt, onInteract, { once: true, passive: true });

    return () => {
      if ('cancelIdleCallback' in window && idleId) window.cancelIdleCallback(idleId);
      else clearTimeout(idleId);
      for (const evt of events) window.removeEventListener(evt, onInteract);
    };
  }, []);

  if (!ready) return null;

  return (
    <Suspense fallback={null}>
      <Toaster {...props} />
    </Suspense>
  );
};

export default ToasterLazy;
