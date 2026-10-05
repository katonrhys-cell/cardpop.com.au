import React, { Suspense, lazy, useEffect, useState } from 'react';
import { onFirstInteractionOrLoad } from '@/lib/deferredLoad.js';

// The sonner Toaster (+ next-themes) is ~15 kB gzip and renders nothing at first
// paint — no toast exists yet. Importing it eagerly from App.jsx put it on the
// critical path where PageSpeed counted it against TBT/unused JS, and mounting
// it at idle still landed its parse/execute inside the measured load window.
// It now mounts on the first interaction (a real interaction almost always
// precedes the first toast) or a few seconds after load (lib/deferredLoad.js).
// sonner keeps queued toasts in a global store, so any toast fired in the
// pre-mount window still renders as soon as the Toaster attaches.
const Toaster = lazy(() => import('@/components/ui/sonner').then(m => ({ default: m.Toaster })));

const ToasterLazy = (props) => {
  const [ready, setReady] = useState(false);

  useEffect(() => onFirstInteractionOrLoad(() => setReady(true)), []);

  if (!ready) return null;

  return (
    <Suspense fallback={null}>
      <Toaster {...props} />
    </Suspense>
  );
};

export default ToasterLazy;
