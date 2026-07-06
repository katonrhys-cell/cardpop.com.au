
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { formatCurrency } from '@/utils/formatCurrency.js';
import { supabase } from '@/lib/supabaseClient.js';

const CartContext = createContext(null);

const CART_STORAGE_KEY = 'e-commerce-cart';

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
};

export const CartProvider = ({ children }) => {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartItems, setCartItems] = useState(() => {
    try {
      const storedCart = localStorage.getItem(CART_STORAGE_KEY);
      return storedCart ? JSON.parse(storedCart) : [];
    } catch (error) {
      console.error('Failed to parse cart from local storage:', error);
      return [];
    }
  });

  // Mirror the latest items in a ref so addToCart can read current state
  // synchronously (the setCartItems updater runs on a later render, so its
  // result isn't observable inside the same call).
  const cartItemsRef = useRef(cartItems);
  useEffect(() => { cartItemsRef.current = cartItems; }, [cartItems]);

  // Sync to local storage
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
    } catch (error) {
      console.error('Failed to save cart to local storage:', error);
    }
  }, [cartItems]);

  // Clear the cart on sign-out so it doesn't leak into a logged-out
  // session or the next user who signs in on the same browser. The cart is
  // stored in localStorage and is not tied to a user id, so without this a
  // shared/public computer would expose (and let the next user check out)
  // the previous user's cart.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setCartItems([]);
        try {
          localStorage.removeItem(CART_STORAGE_KEY);
        } catch (_) { /* storage unavailable in some envs */ }
      }
    });
    return () => subscription?.unsubscribe();
  }, []);

  // Cross-tab synchronization
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === CART_STORAGE_KEY) {
        try {
          setCartItems(e.newValue ? JSON.parse(e.newValue) : []);
        } catch (err) {
          console.error('Failed to sync cart across tabs:', err);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const addToCart = useCallback((product, variant = product.variants?.[0] || product, quantity = 1, availableQuantity = 999) => {
    return new Promise((resolve, reject) => {
      const itemId = variant?.id || product.id;
      const prevItems = cartItemsRef.current;
      const existingItem = prevItems.find(item => (item.variant?.id || item.product.id) === itemId);

      if (variant?.manage_inventory) {
        const currentCartQuantity = existingItem ? existingItem.quantity : 0;
        if ((currentCartQuantity + quantity) > availableQuantity) {
          reject(new Error(`Not enough stock for ${product.title || product.name}. Only ${availableQuantity} left.`));
          return;
        }
      }

      const nextItems = existingItem
        ? prevItems.map(item =>
            (item.variant?.id || item.product.id) === itemId
              ? { ...item, quantity: item.quantity + quantity }
              : item
          )
        : [...prevItems, { product, variant, quantity }];

      cartItemsRef.current = nextItems;
      setCartItems(nextItems);
      setIsCartOpen(true);
      resolve();
    });
  }, []);

  const removeFromCart = useCallback((itemId) => {
    setCartItems(prevItems => prevItems.filter(item => (item.variant?.id || item.product.id) !== itemId));
  }, []);

  const updateQuantity = useCallback((itemId, quantity) => {
    if (quantity < 1) {
      removeFromCart(itemId);
      return;
    }
    setCartItems(prevItems =>
      prevItems.map(item =>
        (item.variant?.id || item.product.id) === itemId ? { ...item, quantity } : item
      )
    );
  }, [removeFromCart]);

  const clearCart = useCallback(() => {
    setCartItems([]);
  }, []);

  const getCartTotal = useCallback(() => {
    if (cartItems.length === 0) return '$0.00';
    
    const totalInCents = cartItems.reduce((total, item) => {
      const price = item.variant?.sale_price_in_cents 
        ?? item.variant?.price_in_cents 
        ?? (item.product.price ? item.product.price * 100 : 0);
      return total + (price * item.quantity);
    }, 0);
    
    try {
      const currencyInfo = cartItems[0]?.variant?.currency_info;
      // formatCurrency returns "" (rather than throwing) when currencyInfo is
      // absent, which every current add-to-cart call site leaves unset — fall
      // back the same way the catch block below does.
      return formatCurrency(totalInCents, currencyInfo) || `$${(totalInCents / 100).toFixed(2)}`;
    } catch (e) {
      return `$${(totalInCents / 100).toFixed(2)}`;
    }
  }, [cartItems]);

  const value = useMemo(() => ({
    cartItems,
    isCartOpen,
    setIsCartOpen,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getCartTotal,
  }), [cartItems, isCartOpen, addToCart, removeFromCart, updateQuantity, clearCart, getCartTotal]);

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};
