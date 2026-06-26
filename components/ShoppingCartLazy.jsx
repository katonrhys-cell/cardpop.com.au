import React, { Suspense, lazy, useEffect, useState } from 'react';
import { useCart } from '@/hooks/useCart.jsx';

// The cart drawer is never visible on first paint, yet it pulls framer-motion
// (~37 KB gzip) plus several Radix primitives (Sheet, ScrollArea, Separator)
// into whatever bundle imports it. Importing it eagerly from App.jsx dragged all
// of that onto the critical path. Here we:
//   1. keep it out of the initial chunk (React.lazy → its own async chunk), and
//   2. only mount it once the user has actually opened the cart, after which it
//      stays mounted so its open/close animation behaves exactly as before.
// To avoid a stutter on the very first open, we warm the chunk during idle time.
const ShoppingCart = lazy(() => import('@/components/ShoppingCart.jsx'));

const prefetchCart = () => import('@/components/ShoppingCart.jsx');

const ShoppingCartLazy = () => {
  const { isCartOpen } = useCart();
  const [hasOpened, setHasOpened] = useState(false);

  // Warm the chunk when the browser is idle so the first open is instant.
  useEffect(() => {
    const ric = window.requestIdleCallback || ((cb) => setTimeout(cb, 1500));
    const cic = window.cancelIdleCallback || clearTimeout;
    const handle = ric(() => { prefetchCart(); });
    return () => cic(handle);
  }, []);

  useEffect(() => {
    if (isCartOpen) setHasOpened(true);
  }, [isCartOpen]);

  if (!hasOpened) return null;

  return (
    <Suspense fallback={null}>
      <ShoppingCart />
    </Suspense>
  );
};

export default ShoppingCartLazy;
