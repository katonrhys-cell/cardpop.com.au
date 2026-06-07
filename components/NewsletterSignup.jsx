import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2, Mail } from 'lucide-react';
import apiServerClient from '@/lib/apiServerClient.js';

const NewsletterSignup = ({ className = '' }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    try {
      const res = await apiServerClient.fetch('/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Subscription failed.');
      }

      setSubscribed(true);
      setEmail('');
      toast.success('You\'re subscribed! Welcome to the CardPop community.');
    } catch (err) {
      toast.error(err.message || 'Failed to subscribe. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (subscribed) {
    return (
      <div className={`flex items-center gap-2 text-sm text-green-600 dark:text-green-500 font-medium ${className}`}>
        <Mail className="w-4 h-4 shrink-0" />
        <span>You're subscribed!</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`flex gap-2 ${className}`}>
      <Input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Your email address"
        disabled={loading}
        className="h-10 bg-background"
        aria-label="Email address for newsletter"
      />
      <Button type="submit" disabled={loading || !email.trim()} className="h-10 shrink-0">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Subscribe'}
      </Button>
    </form>
  );
};

export default NewsletterSignup;
