import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useCart } from '@/hooks/useCart.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import apiServerClient from '@/lib/apiServerClient.js';
import pb from '@/lib/pocketbaseClient.js';
import { toast } from 'sonner';
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
    const initDirectCheckout = async () => {
      if (cardId && source === 'Vault') {
        try {
          const card = await pb.collection('vault_items').getOne(cardId, { expand: 'vault_images' });
          const images = card.expand?.vault_images || [];
          const imageUrl = images[0]
            ? pb.getFileUrl(images[0], images[0].image)
            : null;
          setDirectItem({
            product: {
              id: card.id,
              title: card.card_name,
              price: card.price_aud || card.estimated_value_aud || 0,
              image: imageUrl,
            },
            quantity: 1,
            variant: null,
          });
        } catch {
          toast.error('Item not found or unavailable');
          navigate('/browse');
        }
      }
      setInitializing(false);
    };

    initDirectCheckout();
  }, [cardId, source, navigate]);

  const checkoutItems = directItem ? [directItem] : cartItems;

  // Flatten cart items into a display-friendly shape for child components
  const flatItems = checkoutItems.map(item => ({
    id: item.product?.id,
    name: item.product?.title || item.product?.name || 'Card',
    price: item.variant?.sale_price_in_cents
      ? item.variant.sale_price_in_cents / 100
      : item.product?.price || 0,
    quantity: item.quantity ?? 1,
    image: item.product?.image || item.product?.thumbnail || null,
  }));

  const subtotal = flatItems.reduce((acc, i) => acc + i.price * i.quantity, 0);
  const tax = subtotal * 0.10;
  const total = subtotal + tax;

  const validateShipping = () => {
    const { firstName, lastName, address, suburb, state, postcode } = shippingData;
    if (!firstName || !lastName || !address || !suburb || !state || !postcode) {
      toast.error('Please fill in all shipping address fields.');
      return false;
    }
    return true;
  };

  const handleCheckoutConfirm = async () => {
    setProcessing(true);

    const itemsPayload = flatItems.map(i => ({
      name: i.name,
      price: i.price,
      quantity: i.quantity,
    }));

    const name = [shippingData.firstName, shippingData.lastName].filter(Boolean).join(' ');

    try {
      const res = await apiServerClient.fetch('/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: itemsPayload,
          total,
          customerEmail: shippingData.email || currentUser?.email || '',
          successUrl: `${window.location.origin}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: window.location.href,
          vaultItemId: cardId || null,
          shippingAddress: {
            name,
            address: shippingData.address || '',
            suburb: shippingData.suburb || '',
            state: shippingData.state || '',
            postcode: shippingData.postcode || '',
          },
        }),
      });

      if (!res.ok) throw new Error('Payment service unavailable. Please try again later.');
      const data = await res.json();
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
