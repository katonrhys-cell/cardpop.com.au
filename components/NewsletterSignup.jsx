import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2, Mail } from 'lucide-react';
import apiServerClient from '@/lib/apiServerClient.js';
import Recaptcha from '@/components/Recaptcha.jsx';
import { RECAPTCHA_ENABLED } from '@/lib/recaptcha.js';

const NewsletterSignup = ({
  className = '',
  // Alternate Kit list to subscribe to (e.g. 'launch' for the pre-launch
  // notify list). Omitted for the default newsletter form.
  list,
  // Attribution for launch registrations (e.g. 'launch_modal', 'launch_page').
  source,
  buttonLabel = 'Subscribe',
  successMessage = "You're subscribed!",
  toastMessage = "You're subscribed! Welcome to the CardPop community.",
  onSubscribed,
}) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState('');
  const recaptchaRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    if (RECAPTCHA_ENABLED && !recaptchaToken) {
      toast.error('Please complete the reCAPTCHA challenge.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiServerClient.fetch('/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), recaptchaToken, ...(list && { list }), ...(source && { source }) }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Subscription failed.');
      }

      setSubscribed(true);
      setEmail('');
      toast.success(toastMessage);
      onSubscribed?.();
    } catch (err) {
      // The token is single-use; reset so the user can try again.
      recaptchaRef.current?.reset();
      setRecaptchaToken('');
      toast.error(err.message || 'Failed to subscribe. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (subscribed) {
    return (
      <div className={`flex items-center gap-2 text-sm text-green-600 dark:text-green-500 font-medium ${className}`}>
        <Mail className="w-4 h-4 shrink-0" />
        <span>{successMessage}</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`flex flex-col gap-3 ${className}`}>
      <div className="flex gap-2">
        <Input
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email address"
          disabled={loading}
          className="h-10 bg-background"
          aria-label="Email address for newsletter"
        />
        <Button
          type="submit"
          disabled={loading || !email.trim() || (RECAPTCHA_ENABLED && !recaptchaToken)}
          className="h-10 shrink-0"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : buttonLabel}
        </Button>
      </div>
      <Recaptcha
        ref={recaptchaRef}
        onVerify={setRecaptchaToken}
        onExpire={() => setRecaptchaToken('')}
      />
    </form>
  );
};

export default NewsletterSignup;
