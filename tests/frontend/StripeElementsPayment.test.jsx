import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Inline Google Pay: the Express Checkout Element sits above the card form and
// both confirm the same Checkout Session.
const state = vi.hoisted(() => ({ result: null, expressProps: null, readyArg: { availablePaymentMethods: { googlePay: true } } }));

vi.mock('@/lib/stripeClient.js', () => ({ stripePromise: null, hasStripeKey: true }));
vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }));
vi.mock('@stripe/react-stripe-js/checkout', async () => {
  const ReactMod = await import('react');
  return {
    CheckoutElementsProvider: ({ children }) => <div>{children}</div>,
    useCheckoutElements: () => state.result,
    PaymentElement: () => <div data-testid="payment-element" />,
    ExpressCheckoutElement: (props) => {
      state.expressProps = props;
      ReactMod.useEffect(() => { props.onReady?.(state.readyArg); }, []);
      return <div data-testid="express-element" />;
    },
  };
});

import StripeElementsPayment from '@/components/checkout/StripeElementsPayment.jsx';

const checkoutWith = (confirm) => ({
  type: 'success',
  checkout: { canConfirm: true, total: { total: { amount: 'A$110.00' } }, confirm },
});

beforeEach(() => {
  state.expressProps = null;
  state.readyArg = { availablePaymentMethods: { googlePay: true } };
});

describe('StripeElementsPayment', () => {
  it('renders an inline Google Pay button above the card form', () => {
    state.result = checkoutWith(vi.fn());
    render(<StripeElementsPayment clientSecret="cs_secret" />);
    expect(screen.getByTestId('express-element')).toBeTruthy();
    expect(screen.getByTestId('payment-element')).toBeTruthy();
    expect(state.expressProps.options.paymentMethods.googlePay).toBe('always');
    expect(state.expressProps.options.buttonType.googlePay).toBe('buy');
    expect(screen.getByRole('button', { name: /Pay A\$110\.00/ })).toBeTruthy();
  });

  it('confirms the session with the Google Pay event', async () => {
    const confirm = vi.fn(async () => ({ type: 'success' }));
    state.result = checkoutWith(confirm);
    render(<StripeElementsPayment clientSecret="cs_secret" />);
    const event = { expressPaymentType: 'google_pay' };
    state.expressProps.onConfirm(event);
    await waitFor(() => expect(confirm).toHaveBeenCalledWith({ expressCheckoutConfirmEvent: event }));
  });

  it('shows a decline from the card form', async () => {
    state.result = checkoutWith(vi.fn(async () => ({ type: 'error', error: { message: 'Your card was declined.' } })));
    render(<StripeElementsPayment clientSecret="cs_secret" />);
    fireEvent.click(screen.getByRole('button', { name: /Pay/ }));
    expect(await screen.findByText('Your card was declined.')).toBeTruthy();
  });

  it('hides the express row when no wallet is available', async () => {
    state.readyArg = { availablePaymentMethods: undefined };
    state.result = checkoutWith(vi.fn());
    render(<StripeElementsPayment clientSecret="cs_secret" />);
    await waitFor(() => expect(screen.queryByTestId('express-element')).toBeNull());
    expect(screen.getByTestId('payment-element')).toBeTruthy();
  });
});
