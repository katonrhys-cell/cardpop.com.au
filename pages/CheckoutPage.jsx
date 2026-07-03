import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useCart } from '@/hooks/useCart.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import apiServerClient from '@/lib/apiServerClient.js';
import { supabase } from '@/lib/supabaseClient.js';
import { toast } from 'sonner';

const resolveImg = (path) => {
  if (!path || typeof path !== 'string') return null;
  if (path.startsWith('http')) return path;
  return supabase.storage.from('vault-images').getPublicUrl(path).data.publicUrl;
};
import { ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import OrderSummary from '@/components/checkout/OrderSummary.jsx';
import ShippingAddressForm from '@/components/checkout/ShippingAddressForm.jsx';
import BillingAddressForm from '@/components/checkout/BillingAddressForm.jsx';
import PaymentMethodSelector from '@/components/checkout/PaymentMethodSelector.jsx';
import OrderReviewSection from '@/components/checkout/OrderReviewSection.jsx';

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

  // Authoritative totals come from the server so the displayed amount always
  // matches what Stripe charges (no fabricated tax).
  const [pricing, setPricing] = useState(null);
  useEffect(() => {
    if (serverItems.length === 0) { setPricing(null); return; }
    let cancelled = false;
    apiServerClient.fetch('/stripe/calculate-cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: serverItems }),
    })
      .then(res => (res.ok ? res.json() : null))
      .then(data => { if (!cancelled) setPricing(data); })
      .catch(() => { if (!cancelled) setPricing(null); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartItems, directItem]);

  const clientSubtotal = flatItems.reduce((acc, i) => acc + i.price * i.quantity, 0);
  const subtotal = pricing?.subtotalAud ?? clientSubtotal;
  // Shop prices are GST-inclusive, so the on-top charges are platform fees (+
  // their GST) and shipping. Derive fees from the server totals so the
  // breakdown always sums to what Stripe will charge.
  const shipping = pricing ? Number(pricing.shippingAud || 0) : 0;
  const tax = pricing ? Math.max(0, Math.round((Number(pricing.totalAud) - Number(pricing.subtotalAud) - shipping) * 100) / 100) : 0;
  const total = pricing?.totalAud ?? clientSubtotal;

  const validateShipping = () => {
    const { firstName, lastName, address, suburb, state, postcode } = shippingData;
    if (!firstName || !lastName || !address || !suburb || !state || !postcode) {
      toast.error('Please fill in all shipping address fields.');
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
          shippingAddress: {
            name,
            address: shippingData.address || '',
            suburb: shippingData.suburb || '',
            state: shippingData.state || '',
            postcode: shippingData.postcode || '',
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
            shipping={pricing ? shipping : null}
            discount={0}
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
            shipping={pricing ? shipping : null}
            discount={0}
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
        </div>

      </div>
    </div>
  );
};

export default CheckoutPage;
