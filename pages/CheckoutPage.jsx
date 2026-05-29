import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useCart } from '@/hooks/useCart.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import apiServerClient from '@/lib/apiServerClient.js';
import { supabase } from '@/lib/supabaseClient.js';
import { toast } from 'sonner';

import OrderSummary from '@/components/checkout/OrderSummary.jsx';
import ShippingAddressForm from '@/components/checkout/ShippingAddressForm.jsx';
import BillingAddressForm from '@/components/checkout/BillingAddressForm.jsx';
import PaymentMethodSelector from '@/components/checkout/PaymentMethodSelector.jsx';
import OrderReviewSection from '@/components/checkout/OrderReviewSection.jsx';
import { Loader2 } from 'lucide-react';

const STEPS = {
  SUMMARY: 1,
  SHIPPING: 2,
  BILLING: 3,
  PAYMENT: 4,
  REVIEW: 5
};

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

  const [shippingData, setShippingData] = useState({
    email: currentUser?.email || ''
  });
  const [billingData, setBillingData] = useState({});
  const [sameAsShipping, setSameAsShipping] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState('stripe');
  
  const [discountPct, setDiscountPct] = useState(0);

  useEffect(() => {
    const initDirectCheckout = async () => {
      if (cardId && source === 'Vault') {
        try {
          const { data: card, error } = await supabase
            .from('vault_items')
            .select('*, vault_images(*)')
            .eq('id', cardId)
            .single();
          if (error) throw error;
          const imageUrl = card.vault_images?.[0]?.image_url || null;
          setDirectItem({
            product: {
              id: card.id,
              title: card.card_name,
              price: card.price_aud || card.estimated_value_aud,
              image: imageUrl
            },
            quantity: 1,
            variant: null
          });
        } catch (error) {
          toast.error("Item not found or unavailable");
          navigate('/browse');
        }
      }
      setInitializing(false);
    };

    initDirectCheckout();
  }, [cardId, source, navigate]);

  const checkoutItems = directItem ? [directItem] : cartItems;

  useEffect(() => {
    if (!initializing && checkoutItems.length === 0 && step !== STEPS.SUMMARY) {
      setStep(STEPS.SUMMARY);
    }
  }, [checkoutItems.length, step, initializing]);

  const subtotal = checkoutItems.reduce((acc, item) => {
    const price = item.variant?.sale_price_in_cents 
      ? item.variant.sale_price_in_cents / 100 
      : item.product.price || 0;
    return acc + (price * item.quantity);
  }, 0);

  const discount = subtotal * discountPct;
  const tax = (subtotal - discount) * 0.10;
  const total = subtotal - discount + tax;

  const handleApplyPromo = (pct) => {
    setDiscountPct(pct);
  };

  const handleCheckoutConfirm = async () => {
    if (paymentMethod !== 'stripe') {
      toast.error('Only Stripe is available in this demo.');
      return;
    }

    setProcessing(true);
    const itemsPayload = checkoutItems.map(item => ({
      name: item.product.title || item.product.name || 'Product',
      price: item.variant?.sale_price_in_cents 
        ? item.variant.sale_price_in_cents / 100 
        : item.product.price || 0,
      quantity: item.quantity
    }));

    apiServerClient.fetch('/stripe/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: itemsPayload,
        subtotal,
        tax,
        discount,
        total,
        customerEmail: shippingData.email || currentUser?.email || 'guest@example.com',
        successUrl: `${window.location.origin}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: window.location.href
      })
    })
    .then(res => {
      if (!res.ok) throw new Error('Payment service unavailable. Please try again later.');
      return res.json();
    })
    .then(data => {
      window.open(data.url, '_blank');
      setProcessing(false);
    })
    .catch(err => {
      toast.error(err.message || 'Payment initiation failed.');
      setProcessing(false);
    });
  };

  if (initializing) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const renderStep = () => {
    switch (step) {
      case STEPS.SUMMARY:
        return (
          <OrderSummary 
            cartItems={checkoutItems} 
            subtotal={subtotal} 
            tax={tax} 
            discount={discount} 
            total={total} 
            onEditCart={() => navigate('/browse')}
            onNext={() => {
              if (checkoutItems.length === 0) toast.error("Your cart is empty!");
              else setStep(STEPS.SHIPPING);
            }}
          />
        );
      case STEPS.SHIPPING:
        return (
          <ShippingAddressForm 
            data={shippingData} 
            onChange={(k, v) => setShippingData(p => ({ ...p, [k]: v }))} 
            onNext={() => setStep(STEPS.BILLING)} 
          />
        );
      case STEPS.BILLING:
        return (
          <BillingAddressForm 
            data={billingData} 
            onChange={(k, v) => setBillingData(p => ({ ...p, [k]: v }))}
            sameAsShipping={sameAsShipping}
            setSameAsShipping={setSameAsShipping}
            onNext={() => setStep(STEPS.PAYMENT)}
            onBack={() => setStep(STEPS.SHIPPING)}
          />
        );
      case STEPS.PAYMENT:
        return (
          <PaymentMethodSelector 
            value={paymentMethod}
            onChange={setPaymentMethod}
            onNext={() => setStep(STEPS.REVIEW)}
            onBack={() => setStep(STEPS.BILLING)}
          />
        );
      case STEPS.REVIEW:
        return (
          <OrderReviewSection 
            shippingData={shippingData}
            billingData={billingData}
            sameAsShipping={sameAsShipping}
            paymentMethod={paymentMethod}
            items={checkoutItems}
            subtotal={subtotal}
            tax={tax}
            discount={discount}
            total={total}
            processing={processing}
            onApplyPromo={handleApplyPromo}
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
            <span className={step >= 1 ? "text-primary" : ""}>Cart</span>
            <span className={step >= 2 ? "text-primary" : ""}>Ship</span>
            <span className={step >= 3 ? "text-primary" : ""}>Bill</span>
            <span className={step >= 4 ? "text-primary" : ""}>Pay</span>
            <span className={step >= 5 ? "text-primary" : ""}>Review</span>
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