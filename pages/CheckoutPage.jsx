import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useCart } from '@/hooks/useCart.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import apiServerClient from '@/lib/apiServerClient.js';
import { supabase } from '@/lib/supabaseClient.js';
import { toast } from 'sonner';

// Storage path or absolute URL → CDN-aware public URL.
const resolveImg = (path) => publicImageUrl(path);
import { Loader2, Tag, Wallet, Lock, MapPin, CreditCard, ShoppingBag, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import OrderSummary from '@/components/checkout/OrderSummary.jsx';
import ShippingAddressForm from '@/components/checkout/ShippingAddressForm.jsx';
import BillingAddressForm from '@/components/checkout/BillingAddressForm.jsx';
import PaymentMethodSelector from '@/components/checkout/PaymentMethodSelector.jsx';
import OrderReviewSection from '@/components/checkout/OrderReviewSection.jsx';
import EmbeddedStripeCheckout from '@/components/checkout/EmbeddedStripeCheckout.jsx';
import MarketplacePurchaseGate from '@/components/checkout/MarketplacePurchaseGate.jsx';
import CheckoutReassurance from '@/components/checkout/CheckoutReassurance.jsx';
import { publicImageUrl } from '@/utils/imageUrl.js';
import { getReferralCode } from '@/lib/referral.js';
import { AMAZON_LOCATION_ENABLED } from '@/lib/amazonLocation.js';
import { isValidAbn, normalizeAbn } from '@/utils/abn.js';
import { fetchSavedAddresses, addressRowToShipping, formatAddressLabel } from '@/lib/savedAddresses.js';

// Small numbered section wrapper so the single page reads as an ordered flow
// without a click-through wizard.
const Section = ({ step, icon: Icon, title, subtitle, children }) => (
  <Card className="border-border shadow-sm">
    <CardHeader className="pb-3">
      <CardTitle className="flex items-center gap-3 text-base">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
          {step}
        </span>
        <span className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
          {title}
        </span>
      </CardTitle>
      {subtitle && <p className="pl-10 text-xs text-muted-foreground">{subtitle}</p>}
    </CardHeader>
    <CardContent className="space-y-4">{children}</CardContent>
  </Card>
);

const CheckoutPage = () => {
  const navigate = useNavigate();
  const { cardId } = useParams();
  const [searchParams] = useSearchParams();
  const source = searchParams.get('source');

  const { cartItems } = useCart();
  const { currentUser, isIdentityVerified, profileLoading } = useAuth();
  const [initializing, setInitializing] = useState(true);

  const [directItem, setDirectItem] = useState(null);

  const [shippingData, setShippingData] = useState({ email: currentUser?.email || '' });
  const [billingData, setBillingData] = useState({});
  const [sameAsShipping, setSameAsShipping] = useState(true);
  // Guest opt-in: email me order updates & CardPop news. Defaults off (explicit
  // consent). Only surfaced to logged-out shoppers — members already have an
  // account and manage email preferences in their settings.
  const [subscribeNews, setSubscribeNews] = useState(false);

  // Saved-address book (signed-in buyers only). Prefills the form so a returning
  // buyer doesn't retype their address; the "save" checkbox opts a new address
  // into the book (persisted server-side after the order is paid).
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [saveAddress, setSaveAddress] = useState(true);
  const prefilledRef = useRef(false);

  // Single-page payment reveal. Everything lives on one page; the buyer commits
  // to paying with "Review & pay", which validates the details and mounts the
  // Stripe form — this is the commit point that seeds the Stripe session, so it
  // isn't recreated on every keystroke while the address is being typed.
  const [readyToPay, setReadyToPay] = useState(false);
  const paymentRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const initDirectCheckout = async () => {
      if (cardId && source === 'Vault') {
        try {
          const { data: card, error } = await supabase
            .from('vault_items')
            .select('*, vault_images(*)')
            .eq('id', cardId)
            .single();
          if (error) throw error;

          // You can only buy a vault item that has an active marketplace listing —
          // that listing is the authoritative, server-priced entity to purchase.
          const { data: listing } = await supabase
            .from('listings')
            .select('id, price_aud')
            .eq('vault_item_id', cardId)
            .eq('status', 'active')
            .maybeSingle();

          if (!listing) {
            if (!cancelled) {
              toast.error('This item is not currently for sale.');
              navigate('/marketplace');
            }
            return;
          }

          const images = card.vault_images || [];
          const imageUrl = images[0]?.image_url || resolveImg(images[0]?.image) || null;
          if (!cancelled) setDirectItem({
            product: {
              id: listing.id,
              type: 'listing',
              title: card.card_name,
              price: listing.price_aud || 0,
              image: imageUrl,
            },
            quantity: 1,
            variant: null,
          });
        } catch (err) {
          if (!cancelled) {
            toast.error('Item not found or unavailable');
            navigate('/marketplace');
          }
        }
      }
      if (!cancelled) setInitializing(false);
    };

    initDirectCheckout();
    return () => { cancelled = true; };
  }, [cardId, source, navigate]);

  // Load the buyer's saved addresses and prefill the default one (once), so a
  // returning member starts from a filled-in form. Best-effort and guest-safe:
  // fetchSavedAddresses returns [] when there's no user id.
  useEffect(() => {
    if (!currentUser?.id) return;
    let cancelled = false;
    fetchSavedAddresses(currentUser.id).then((list) => {
      if (cancelled || list.length === 0) return;
      setSavedAddresses(list);
      if (!prefilledRef.current) {
        prefilledRef.current = true;
        const def = list[0];
        setSelectedAddressId(def.id);
        setShippingData((prev) => ({ ...addressRowToShipping(def, currentUser.email || prev.email || '') }));
      }
    });
    return () => { cancelled = true; };
  }, [currentUser?.id, currentUser?.email]);

  const handlePickAddress = (value) => {
    setSelectedAddressId(value);
    if (value === '__new') {
      setShippingData({ email: currentUser?.email || shippingData.email || '' });
      return;
    }
    const row = savedAddresses.find((a) => a.id === value);
    if (row) setShippingData(addressRowToShipping(row, currentUser?.email || shippingData.email || ''));
  };

  const checkoutItems = directItem ? [directItem] : cartItems;

  // Marketplace (peer-to-peer 'listing') items require an identity-verified
  // buyer; CardPop Shop items don't. Items default to 'listing' when untyped.
  // When the order contains a marketplace item and the buyer isn't a verified
  // account, we gate the whole checkout up front — the server enforces the same
  // rule (requireIdentityForMarketplacePurchase), so this is UX, not the guard.
  const hasMarketplaceItem = checkoutItems.some((i) => (i.product?.type || 'listing') === 'listing');
  const marketplaceBlocked = hasMarketplaceItem && !profileLoading && !(currentUser && isIdentityVerified);

  // Flatten cart items into a display-friendly shape for child components
  const flatItems = checkoutItems.map(item => {
    const p = item.product || {};
    const rawImg = item.variant?.image_url || p.image || p.images?.[0] || p.thumbnail || null;
    const gradingCompany = p.grading_company || p.gradingCompany || null;
    const grade = p.grade || null;
    const gradeLabel = gradingCompany && grade && gradingCompany !== 'raw'
      ? `${gradingCompany.toUpperCase()} ${grade}`
      : (grade ? `Grade ${grade}` : null);
    const year = p.year || p.card_year || null;
    const set = p.set || p.card_set || p.era || p.collection || null;

    const nameParts = [year, p.title || p.name || 'Card', set, gradeLabel].filter(Boolean);
    return {
      id: p.id,
      name: nameParts.join(' · '),
      price: item.variant?.sale_price_in_cents
        ? item.variant.sale_price_in_cents / 100
        : p.price || 0,
      quantity: item.quantity ?? 1,
      image: resolveImg(rawImg),
    };
  });

  // Typed line items the server can re-price from its own source of truth.
  const serverItems = checkoutItems
    .map(i => ({ type: i.product?.type || 'listing', id: i.product?.id, quantity: i.quantity ?? 1 }))
    .filter(i => i.id);

  // Promo code (welcome offer or partner referral code). `promoCode` is the
  // applied code (sent to the server for validation and pricing); `promoInput`
  // is just the field state. A ?ref=CODE partner link captured earlier in the
  // session pre-fills and auto-applies — the server rejects it harmlessly if
  // it's stale or invalid.
  const [promoInput, setPromoInput] = useState(() => getReferralCode());
  const [promoCode, setPromoCode] = useState(() => getReferralCode());

  // Wallet balance (Stripe Customer Balance — CardPop holds no ledger of its
  // own). Mutually exclusive with a promo code; toggling one clears the other.
  const [walletBalance, setWalletBalance] = useState(0);
  const [useWallet, setUseWallet] = useState(false);
  useEffect(() => {
    apiServerClient.fetch('/wallet/balance')
      .then(res => (res.ok ? res.json() : null))
      .then(data => { if (data) setWalletBalance(Number(data.balanceAud) || 0); })
      .catch(() => {});
  }, []);

  // Authoritative totals come from the server so the displayed amount always
  // matches what Stripe charges (no fabricated tax).
  const [pricing, setPricing] = useState(null);
  useEffect(() => {
    if (serverItems.length === 0) { setPricing(null); return; }
    let cancelled = false;
    apiServerClient.fetch('/stripe/calculate-cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: serverItems,
        ...(useWallet ? { useWalletBalance: true } : (promoCode ? { promoCode } : {})),
      }),
    })
      .then(async res => {
        if (res.ok) return { ok: true, data: await res.json() };
        // Surface the server's actionable message (409 out of stock, 403 own
        // listing, 404 no longer available) instead of silently falling back to
        // a fee-less client subtotal with no explanation.
        let error = '';
        try { const body = await res.json(); error = body?.error || body?.message || ''; } catch { /* non-JSON error body */ }
        return { ok: false, error };
      })
      .then(result => {
        if (cancelled) return;
        if (!result.ok) {
          setPricing(null);
          if (result.error) toast.error(result.error);
          return;
        }
        const data = result.data;
        setPricing(data);
        if (data?.promoError) {
          toast.error(data.promoError);
          setPromoCode('');
        } else if (promoCode && !useWallet && data?.discountAud > 0) {
          toast.success(`Code applied — $${Number(data.discountAud).toFixed(2)} off.`);
        }
      })
      .catch(() => { if (!cancelled) setPricing(null); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartItems, directItem, promoCode, useWallet]);

  const clientSubtotal = flatItems.reduce((acc, i) => acc + i.price * i.quantity, 0);
  const subtotal = pricing?.subtotalAud ?? clientSubtotal;
  // Platform commission and GST are distinct charges (and distinct Stripe line
  // items) — shown as separate "Service fee" and "GST" lines, never merged.
  const serviceFee = pricing ? Number(pricing.commissionAud || 0) : 0;
  const gst = pricing ? Number(pricing.gstAud || 0) : 0;
  // Flat shipping fee on CardPop Shop items (server-calculated from Platform
  // Settings); 0 when the cart has no shop items or the order ships free.
  const shipping = pricing ? Number(pricing.shippingAud || 0) : 0;
  const discount = pricing && !pricing.promoError ? Number(pricing.discountAud || 0) : 0;
  const total = pricing?.totalAud ?? clientSubtotal;
  const appliedPromoCode = discount > 0 ? promoCode : '';

  const validateShipping = () => {
    const { email, firstName, lastName, address, suburb, state, postcode, verified, placesUnavailable } = shippingData;
    if (!firstName || !lastName || !address || !suburb || !state || !postcode) {
      toast.error('Please fill in all shipping address fields.');
      return false;
    }
    // Email is required — it's the receipt address (and where the order
    // confirmation is sent), especially for guests with no account on file.
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error('Please enter a valid email address for your receipt.');
      return false;
    }
    // When Amazon Location autocomplete is active, the address must be one the
    // user picked from the suggestions (verified) — not free-typed. Skipped if
    // it couldn't load; the server still validates the address before charging.
    if (AMAZON_LOCATION_ENABLED && !placesUnavailable && !verified) {
      toast.error('Please select your address from the suggestions so we can verify it.');
      return false;
    }
    return true;
  };

  const validateBilling = () => {
    if (billingData.isBusiness) {
      if (!billingData.businessName?.trim()) {
        toast.error('Please enter your business name.');
        return false;
      }
      if (!isValidAbn(billingData.abn)) {
        toast.error('Please enter a valid 11-digit ABN.');
        return false;
      }
    }
    return true;
  };

  const handleReviewAndPay = () => {
    if (flatItems.length === 0) { toast.error('Your cart is empty!'); return; }
    if (!validateShipping()) return;
    if (!validateBilling()) return;
    setReadyToPay(true);
    // Scroll the newly-revealed payment form into view (guarded — happy-dom in
    // tests has no scrollIntoView).
    setTimeout(() => paymentRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }), 50);
  };

  // Stable request body for the inline Stripe form. It must not change identity
  // on every render — Stripe's EmbeddedCheckoutProvider fetches the client
  // secret once, and a new object would recreate the session. Serialising the
  // dependencies keeps it stable until the order actually changes.
  const shippingName = [shippingData.firstName, shippingData.lastName].filter(Boolean).join(' ');
  // serverItems is a fresh array each render; track it by its serialised key so
  // the memo (and the Stripe session it seeds) only changes when the order does.
  const serverItemsKey = JSON.stringify(serverItems);
  // Only forward business details when a valid ABN was supplied — this is what
  // switches the server onto the tax-invoice path.
  const billingAbn = billingData.isBusiness && isValidAbn(billingData.abn) ? normalizeAbn(billingData.abn) : '';
  const billingBusinessName = billingAbn ? (billingData.businessName || '').trim() : '';
  const contactEmail = (shippingData.email || '').trim();
  // Signed-in buyers can opt to save this address to their account (persisted
  // server-side once the order is paid). Guests have no account to save to.
  const wantsAddressSaved = !!currentUser && saveAddress;
  const checkoutRequestBody = useMemo(() => ({
    items: serverItems,
    // Receipt address — for guests this is the only email on file; the server
    // prefers a logged-in buyer's account email over it.
    email: contactEmail,
    // Guest opt-in to order-updates & news; the webhook subscribes on payment.
    ...(subscribeNews ? { subscribeNewsletter: true } : {}),
    ...(wantsAddressSaved ? { saveShippingAddress: true } : {}),
    ...(useWallet ? { useWalletBalance: true } : (appliedPromoCode ? { promoCode: appliedPromoCode } : {})),
    shippingAddress: {
      name: shippingName,
      address: shippingData.address || '',
      address2: shippingData.address2 || '',
      suburb: shippingData.suburb || '',
      state: shippingData.state || '',
      postcode: shippingData.postcode || '',
    },
    ...(billingAbn ? { billingDetails: { businessName: billingBusinessName, abn: billingAbn } } : {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [
    serverItemsKey,
    contactEmail,
    subscribeNews,
    wantsAddressSaved,
    useWallet,
    appliedPromoCode,
    shippingName,
    shippingData.address,
    shippingData.address2,
    shippingData.suburb,
    shippingData.state,
    shippingData.postcode,
    billingAbn,
    billingBusinessName,
  ]);

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const orderSummary = (
    <OrderSummary
      cartItems={flatItems}
      subtotal={subtotal}
      serviceFee={serviceFee}
      gst={gst}
      shipping={shipping}
      discount={discount}
      total={total}
      onEditCart={() => navigate('/marketplace')}
    />
  );

  const promoCard = currentUser && flatItems.length > 0 && (
    <Card className="border-border shadow-sm">
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
          <Tag className="h-4 w-4 text-primary" /> Promo Code
        </div>
        {appliedPromoCode ? (
          <div className="flex items-center justify-between text-sm">
            <span className="font-mono tracking-widest">{appliedPromoCode}</span>
            <span className="text-green-600 font-semibold">−${discount.toFixed(2)} applied</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setPromoCode(''); setPromoInput(''); }}
            >
              Remove
            </Button>
          </div>
        ) : (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (promoInput.trim()) { setUseWallet(false); setPromoCode(promoInput.trim().toUpperCase()); }
            }}
          >
            <Input
              value={promoInput}
              onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
              placeholder="POP-XXXX-XXXX"
              autoComplete="off"
              className="font-mono tracking-widest uppercase"
              aria-label="Promo code"
              disabled={useWallet}
            />
            <Button type="submit" variant="outline" className="shrink-0" disabled={useWallet}>Apply</Button>
          </form>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          New here? Your welcome email includes a code for 10% off your first order.
        </p>
      </CardContent>
    </Card>
  );

  const walletCard = currentUser && flatItems.length > 0 && walletBalance > 0 && (
    <Card className="border-border shadow-sm">
      <CardContent className="pt-6">
        <label className="flex items-center gap-3 text-sm cursor-pointer">
          <Checkbox
            checked={useWallet}
            onCheckedChange={(checked) => {
              setUseWallet(!!checked);
              if (checked) { setPromoCode(''); setPromoInput(''); }
            }}
          />
          <span className="flex items-center gap-2 font-semibold text-foreground">
            <Wallet className="h-4 w-4 text-primary" /> Use wallet balance
          </span>
          <span className="ml-auto text-muted-foreground">${walletBalance.toFixed(2)} available</span>
        </label>
        <p className="mt-2 text-xs text-muted-foreground">
          Applies toward this order — can't be combined with a promo code.
        </p>
      </CardContent>
    </Card>
  );

  return (
    <div className="bg-muted/20 py-10">
      <Helmet><title>Secure Checkout | Card Pop</title></Helmet>
      <div className="max-w-6xl mx-auto px-4">

        <header className="mb-8">
          <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">Secure checkout</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Lock className="h-3.5 w-3.5" /> Encrypted &amp; processed by Stripe — you never leave this page.
          </p>
        </header>

        {marketplaceBlocked ? (
          <div className="mx-auto max-w-2xl">
            <MarketplacePurchaseGate returnPath="/checkout" />
          </div>
        ) : flatItems.length === 0 ? (
          <Card className="mx-auto max-w-lg border-border shadow-sm">
            <CardContent className="flex flex-col items-center px-6 py-12 text-center">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                <ShoppingBag className="h-7 w-7 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-bold text-foreground">Your cart is empty</h2>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                Browse the marketplace to find your next grail — it'll show up here ready to check out.
              </p>
              <Button className="mt-6" onClick={() => navigate('/marketplace')}>
                Browse marketplace <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
            {/* ── Left: details ─────────────────────────────────────────── */}
            <div className="space-y-6">
              <Section step={1} icon={MapPin} title="Contact & shipping">
                {savedAddresses.length > 0 && (
                  <div className="space-y-1">
                    <Label>Saved addresses</Label>
                    <Select value={selectedAddressId} onValueChange={handlePickAddress}>
                      <SelectTrigger><SelectValue placeholder="Choose a saved address" /></SelectTrigger>
                      <SelectContent>
                        {savedAddresses.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.label ? `${a.label} — ` : ''}{formatAddressLabel(a)}
                          </SelectItem>
                        ))}
                        <SelectItem value="__new">Use a new address</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <ShippingAddressForm
                  values={shippingData}
                  onChange={(next) => {
                    setShippingData(next);
                    // Typing a fresh address means it's no longer one of the
                    // saved picks.
                    if (selectedAddressId && selectedAddressId !== '__new') setSelectedAddressId('__new');
                  }}
                  showEmail
                />

                {!currentUser && (
                  <label className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-3 text-sm cursor-pointer">
                    <Checkbox
                      className="mt-0.5"
                      checked={subscribeNews}
                      onCheckedChange={(checked) => setSubscribeNews(!!checked)}
                    />
                    <span className="text-muted-foreground">
                      Email me order updates and CardPop news. You'll be able to create an
                      account after payment to track your order.
                    </span>
                  </label>
                )}

                {currentUser && (
                  <label className="flex items-center gap-3 text-sm cursor-pointer">
                    <Checkbox
                      checked={saveAddress}
                      onCheckedChange={(checked) => setSaveAddress(!!checked)}
                    />
                    <span className="text-muted-foreground">Save this address to my account for faster checkout next time.</span>
                  </label>
                )}
              </Section>

              <Section step={2} icon={CreditCard} title="Billing">
                <BillingAddressForm
                  values={billingData}
                  onChange={setBillingData}
                  shippingAddress={shippingData}
                  sameAsShipping={sameAsShipping}
                  onSameAsShippingChange={setSameAsShipping}
                />
              </Section>

              <div ref={paymentRef}>
                <Section step={3} icon={Lock} title="Payment">
                  <PaymentMethodSelector />
                  {readyToPay ? (
                    <div className="space-y-4">
                      <OrderReviewSection
                        shippingData={shippingData}
                        billingData={billingData}
                        sameAsShipping={sameAsShipping}
                        items={flatItems}
                        subtotal={subtotal}
                        serviceFee={serviceFee}
                        gst={gst}
                        shipping={shipping}
                        discount={discount}
                        total={total}
                      />
                      <EmbeddedStripeCheckout requestBody={checkoutRequestBody} />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Button size="lg" className="w-full font-semibold" onClick={handleReviewAndPay}>
                        Review &amp; Pay ${Number(total).toFixed(2)}
                      </Button>
                      <p className="text-center text-xs text-muted-foreground">
                        You'll review your order before payment is taken. No charge until you confirm.
                      </p>
                    </div>
                  )}
                </Section>
              </div>
            </div>

            {/* ── Right: sticky summary ─────────────────────────────────── */}
            <aside className="space-y-4 lg:sticky lg:top-6">
              {orderSummary}
              {promoCard}
              {walletCard}
              <CheckoutReassurance />
            </aside>
          </div>
        )}
      </div>
    </div>
  );
};

export default CheckoutPage;
