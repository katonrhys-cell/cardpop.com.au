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

  // Warm the chunk on the user's FIRST interaction so opening the cart is
  // instant. Warming at idle (the previous approach) pulled framer-motion +
  // Radix into the initial load window on every visit — ~110 kB of parse and
  // execute that PageSpeed counted against TBT/unused JS even though the cart
  // never opened. A user can't open the cart without interacting first, so
  // this loses nothing.
  useEffect(() => {
    const events = ['pointerdown', 'keydown', 'touchstart'];
    let warmed = false;
    const warm = () => {
      if (warmed) return;
      warmed = true;
      for (const evt of events) window.removeEventListener(evt, warm);
      prefetchCart();
    };
    for (const evt of events) window.addEventListener(evt, warm, { once: true, passive: true });
    return () => { for (const evt of events) window.removeEventListener(evt, warm); };
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
