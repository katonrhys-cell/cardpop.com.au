import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useCart } from '@/hooks/useCart.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import apiServerClient from '@/lib/apiServerClient.js';
import { supabase } from '@/lib/supabaseClient.js';
import { toast } from 'sonner';

// Storage path or absolute URL → CDN-aware public URL.
const resolveImg = (path) => publicImageUrl(path);
import { ArrowRight, Loader2, Tag, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

import OrderSummary from '@/components/checkout/OrderSummary.jsx';
import ShippingAddressForm from '@/components/checkout/ShippingAddressForm.jsx';
import BillingAddressForm from '@/components/checkout/BillingAddressForm.jsx';
import PaymentMethodSelector from '@/components/checkout/PaymentMethodSelector.jsx';
import OrderReviewSection from '@/components/checkout/OrderReviewSection.jsx';
import { publicImageUrl } from '@/utils/imageUrl.js';
import { getReferralCode } from '@/lib/referral.js';
import { GOOGLE_PLACES_ENABLED } from '@/lib/googlePlaces.js';

const STEPS = { SUMMARY: 1, SHIPPING: 2, BILLING: 3, PAYMENT: 4, REVIEW: 5 };
const STEP_LABELS = ['Cart', 'Ship', 'Bill', 'Pay', 'Review'];

const CheckoutPage = () => {
  const navigate = useNavigate();
  const { cardId } = useParams();
  const [searchParams] = useSearchParams();
  const source = searchParams.get('source');

  const { cartItems } = useCart();
  const { currentUser } = useAuth();
  const [step, setStep] = useState(STEPS.SUMMARY);
  const [processing, setProcessing] = useState(false);
  const [initializing, setInitializing] = useState(true);

  const [directItem, setDirectItem] = useState(null);

  const [shippingData, setShippingData] = useState({ email: currentUser?.email || '' });
  const [billingData, setBillingData] = useState({});
  const [sameAsShipping, setSameAsShipping] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState('card');

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
              navigate('/browse');
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
            navigate('/browse');
          }
        }
      }
      if (!cancelled) setInitializing(false);
    };

    initDirectCheckout();
    return () => { cancelled = true; };
  }, [cardId, source, navigate]);

  const checkoutItems = directItem ? [directItem] : cartItems;

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
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (cancelled) return;
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
  const tax = pricing ? (Number(pricing.commissionAud || 0) + Number(pricing.gstAud || 0)) : 0;
  const discount = pricing && !pricing.promoError ? Number(pricing.discountAud || 0) : 0;
  const total = pricing?.totalAud ?? clientSubtotal;
  const appliedPromoCode = discount > 0 ? promoCode : '';

  const validateShipping = () => {
    const { firstName, lastName, address, suburb, state, postcode, verified, placesUnavailable } = shippingData;
    if (!firstName || !lastName || !address || !suburb || !state || !postcode) {
      toast.error('Please fill in all shipping address fields.');
      return false;
    }
    // When Google Places is active, the address must be one the user picked from
    // the suggestions (verified) — not free-typed. Skipped if Places couldn't
    // load; the server still validates the address before charging.
    if (GOOGLE_PLACES_ENABLED && !placesUnavailable && !verified) {
      toast.error('Please select your address from the suggestions so we can verify it.');
      return false;
    }
    return true;
  };

  const handleCheckoutConfirm = async () => {
    if (serverItems.length === 0) { toast.error('Your cart is empty!'); return; }
    setProcessing(true);

    const name = [shippingData.firstName, shippingData.lastName].filter(Boolean).join(' ');

    try {
      const res = await apiServerClient.fetch('/stripe/create-cart-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: serverItems,
          successUrl: `${window.location.origin}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: window.location.href,
          ...(useWallet ? { useWalletBalance: true } : (appliedPromoCode ? { promoCode: appliedPromoCode } : {})),
          shippingAddress: {
            name,
            address: shippingData.address || '',
            address2: shippingData.address2 || '',
            suburb: shippingData.suburb || '',
            state: shippingData.state || '',
            postcode: shippingData.postcode || '',
            placeId: shippingData.placeId || '',
            verified: Boolean(shippingData.verified),
          },
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Payment service unavailable. Please try again later.');
      if (!data?.url) throw new Error('No checkout URL returned from payment service.');
      window.location.href = data.url;
    } catch (err) {
      toast.error(err.message || 'Payment initiation failed.');
      setProcessing(false);
    }
  };

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderStep = () => {
    switch (step) {
      case STEPS.SUMMARY:
        return (
          <OrderSummary
            cartItems={flatItems}
            subtotal={subtotal}
            tax={tax}
            discount={discount}
            total={total}
            onEditCart={() => navigate('/browse')}
            onNext={() => {
              if (flatItems.length === 0) { toast.error('Your cart is empty!'); return; }
              setStep(STEPS.SHIPPING);
            }}
          />
        );

      case STEPS.SHIPPING:
        return (
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Shipping Address</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ShippingAddressForm
                values={shippingData}
                onChange={setShippingData}
                showEmail
              />
              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(STEPS.SUMMARY)}>Back</Button>
                <Button onClick={() => { if (validateShipping()) setStep(STEPS.BILLING); }}>
                  Continue <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case STEPS.BILLING:
        return (
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Billing Address</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <BillingAddressForm
                values={billingData}
                onChange={setBillingData}
                shippingAddress={shippingData}
                sameAsShipping={sameAsShipping}
                onSameAsShippingChange={setSameAsShipping}
              />
              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(STEPS.SHIPPING)}>Back</Button>
                <Button onClick={() => setStep(STEPS.PAYMENT)}>
                  Continue <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case STEPS.PAYMENT:
        return (
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Payment Method</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <PaymentMethodSelector value={paymentMethod} onChange={setPaymentMethod} />
              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(STEPS.BILLING)}>Back</Button>
                <Button onClick={() => setStep(STEPS.REVIEW)}>
                  Review Order <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case STEPS.REVIEW:
        return (
          <OrderReviewSection
            shippingData={shippingData}
            billingData={billingData}
            sameAsShipping={sameAsShipping}
            paymentMethod={paymentMethod}
            items={flatItems}
            subtotal={subtotal}
            tax={tax}
            discount={discount}
            total={total}
            processing={processing}
            onConfirm={handleCheckoutConfirm}
            onBack={() => setStep(STEPS.PAYMENT)}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-muted/20 py-12">
      <Helmet><title>Secure Checkout | Card Pop</title></Helmet>
      <div className="max-w-4xl mx-auto px-4">

        <div className="mb-10">
          <div className="flex items-center justify-between relative max-w-2xl mx-auto">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-border -z-10 rounded-full" />
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary -z-10 rounded-full transition-all duration-500"
              style={{ width: `${((step - 1) / 4) * 100}%` }}
            />
            {[1, 2, 3, 4, 5].map((idx) => (
              <div
                key={idx}
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors duration-300 ${step >= idx ? 'bg-primary text-white shadow-md' : 'bg-card text-muted-foreground border-2 border-border'}`}
              >
                {idx}
              </div>
            ))}
          </div>
          <div className="flex justify-between max-w-2xl mx-auto mt-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {STEP_LABELS.map((label, i) => (
              <span key={label} className={step >= i + 1 ? 'text-primary' : ''}>{label}</span>
            ))}
          </div>
        </div>

        <div className="max-w-2xl mx-auto">
          {renderStep()}

          {step === STEPS.SUMMARY && flatItems.length > 0 && walletBalance > 0 && (
            <Card className="border-border shadow-sm mt-4">
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
          )}

          {step === STEPS.SUMMARY && flatItems.length > 0 && (
            <Card className="border-border shadow-sm mt-4">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                  <Tag className="h-4 w-4 text-primary" /> Promo code
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
          )}
        </div>

      </div>
    </div>
  );
};

export default CheckoutPage;
