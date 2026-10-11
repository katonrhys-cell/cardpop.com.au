import React, { useEffect, useRef, useState } from 'react';
import { Bell, CheckCircle, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Turnstile from '@/components/Turnstile.jsx';
import { TURNSTILE_ENABLED } from '@/lib/turnstile.js';
import apiServerClient from '@/lib/apiServerClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';

export const SHOP_ENQUIRY_EMAIL = 'noreply@cardpop.com.au';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_MESSAGE = 2000;

/**
 * "Enquire" dialog for a sold-out shop product. Posts to /shop-enquiry, which
 * emails the admin inbox (noreply@cardpop.com.au) with reply-to set to the
 * shopper. Works logged-out; a signed-in shopper gets name/email pre-filled.
 *
 * Props:
 *   open, onOpenChange — controlled Dialog state.
 *   product            — { id, title } of the shop_products row.
 *   reason             — 'sold_out' (default) | 'coming_soon'; picks the copy
 *                        and is sent to the server so the email says which.
 */
const COPY = {
  sold_out: {
    title: 'Enquire about this item',
    intro: (title) => <><strong>{title}</strong> is currently sold out. Leave your details and we&apos;ll let you know about restocks or alternatives.</>,
    placeholder: 'e.g. How many are you expecting, and when?',
    done: 'and will reply to',
  },
  coming_soon: {
    title: 'Register your interest',
    intro: (title) => <><strong>{title}</strong> is coming soon. Leave your details and we&apos;ll let you know as soon as it&apos;s available to order.</>,
    placeholder: 'e.g. Which colour or size are you after?',
    done: 'and will reply to',
  },
};

const ShopEnquiryDialog = ({ open, onOpenChange, product, reason = 'sold_out' }) => {
  const copy = COPY[reason] || COPY.sold_out;
  const auth = useAuth() || {};
  const { currentUser, profile } = auth;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [company, setCompany] = useState(''); // honeypot — real users leave blank
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sent, setSent] = useState(false);
  // 'notify' = the one-field "email me when it's back" (sold-out only);
  // 'enquiry' = the full name/email/message form.
  const [mode, setMode] = useState(reason === 'sold_out' ? 'notify' : 'enquiry');
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileRef = useRef(null);

  const title = product?.title || product?.name || 'this product';

  // Pre-fill from the signed-in account each time the dialog opens; keep
  // whatever the shopper typed if they reopen it mid-edit. Keyed on the
  // primitive values (not the auth objects) so an auth-context re-render
  // can't re-run this mid-submit.
  const prefillName = profile?.display_name || profile?.full_name || currentUser?.user_metadata?.full_name || '';
  const prefillEmail = currentUser?.email || profile?.email || '';
  useEffect(() => {
    if (!open) return;
    setName((prev) => prev || prefillName);
    setEmail((prev) => prev || prefillEmail);
  }, [open, prefillName, prefillEmail]);

  const reset = () => {
    setSent(false);
    setMode(reason === 'sold_out' ? 'notify' : 'enquiry');
    setErrors({});
    setSendError('');
    setMessage('');
    setCompany('');
  };

  const handleOpenChange = (next) => {
    onOpenChange?.(next);
    if (!next) reset();
  };

  const validate = () => {
    const errs = {};
    if (mode === 'enquiry' && name.trim().length < 2) errs.name = 'Please enter your name';
    if (!EMAIL_RE.test(email.trim())) errs.email = 'Please enter a valid email address';
    if (message.length > MAX_MESSAGE) errs.message = `Keep your message under ${MAX_MESSAGE} characters`;
    return errs;
  };

  const mailtoUrl = `mailto:${SHOP_ENQUIRY_EMAIL}?subject=${encodeURIComponent(`[CardPop] ${reason === 'coming_soon' ? 'Coming soon' : 'Stock'} enquiry: ${title}`)}` +
    `&body=${encodeURIComponent(`Name: ${name}\nEmail: ${email}\nProduct: ${title}${product?.id ? ` (${product.id})` : ''}\n\n${message}`)}`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    if (!product?.id) { setSendError('This product could not be identified. Please try again from the product page.'); return; }

    setSending(true);
    setSendError('');
    try {
      if (mode === 'notify') {
        const res = await apiServerClient.fetch('/shop-enquiry/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: product.id, email: email.trim(), company, turnstileToken }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { setSendError(data.error || 'We could not save your request. Please try again.'); return; }
        setSent(true);
        toast.success('We’ll email you when it’s back in stock.');
        return;
      }
      const res = await apiServerClient.fetch('/shop-enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          reason,
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
          company,
          turnstileToken,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSendError(data.error || 'We could not send your enquiry. Please try again.');
        return;
      }
      setSent(true);
      toast.success('Enquiry sent — we will be in touch.');
    } catch {
      setSendError('We could not reach the server. Please check your connection and try again.');
    } finally {
      setSending(false);
      // Turnstile tokens are single-use — reset for any subsequent attempt.
      setTurnstileToken('');
      turnstileRef.current?.reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        {sent ? (
          <>
            <DialogHeader className="items-center text-center">
              <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-2">
                <CheckCircle className="w-7 h-7 text-green-600 dark:text-green-400" />
              </div>
              <DialogTitle>{mode === 'notify' ? 'You’re on the list' : 'Enquiry sent'}</DialogTitle>
              <DialogDescription>
                {mode === 'notify' ? (
                  <>We&apos;ll email {email.trim()} the moment <strong>{title}</strong> is back in stock — one email, nothing else.</>
                ) : (
                  <>Thanks — we&apos;ve passed your enquiry about <strong>{title}</strong> to the CardPop team
                  and will reply to {email.trim()} as soon as we know more.</>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)} className="w-full sm:w-auto">Done</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <DialogHeader>
              <DialogTitle>{mode === 'notify' ? 'Email me when it’s back' : copy.title}</DialogTitle>
              <DialogDescription>
                {mode === 'notify'
                  ? <><strong>{title}</strong> is sold out right now. Leave your email and we&apos;ll send one message when it&apos;s back in stock.</>
                  : copy.intro(title)}
              </DialogDescription>
            </DialogHeader>

            {mode === 'enquiry' && (
            <div className="space-y-1.5">
              <Label htmlFor="shop-enquiry-name">Name</Label>
              <Input
                id="shop-enquiry-name"
                name="name"
                autoComplete="name"
                value={name}
                onChange={(e) => { setName(e.target.value); if (errors.name) setErrors((p) => ({ ...p, name: undefined })); }}
                aria-invalid={!!errors.name}
                disabled={sending}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="shop-enquiry-email">Email</Label>
              <Input
                id="shop-enquiry-email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors((p) => ({ ...p, email: undefined })); }}
                aria-invalid={!!errors.email}
                disabled={sending}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>

            {mode === 'enquiry' && (
            <div className="space-y-1.5">
              <Label htmlFor="shop-enquiry-message">Message <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                id="shop-enquiry-message"
                name="message"
                rows={4}
                maxLength={MAX_MESSAGE}
                placeholder={copy.placeholder}
                value={message}
                onChange={(e) => { setMessage(e.target.value); if (errors.message) setErrors((p) => ({ ...p, message: undefined })); }}
                disabled={sending}
              />
              {errors.message && <p className="text-xs text-destructive">{errors.message}</p>}
            </div>
            )}
            {mode === 'notify' && (
              <p className="text-xs text-muted-foreground">
                Have a question instead?{' '}
                <button type="button" className="underline font-semibold" onClick={() => setMode('enquiry')} disabled={sending}>
                  Send an enquiry
                </button>
              </p>
            )}

            {/* Honeypot: visually hidden, ignored by real users, filled by bots. */}
            <div className="absolute -left-[9999px] top-auto w-px h-px overflow-hidden" aria-hidden="true">
              <label htmlFor="shop-enquiry-company">Company</label>
              <input
                id="shop-enquiry-company"
                name="company"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>

            {TURNSTILE_ENABLED && (
              <Turnstile
                ref={turnstileRef}
                onVerify={setTurnstileToken}
                onExpire={() => setTurnstileToken('')}
              />
            )}

            {sendError && (
              <p className="text-sm text-destructive" role="alert">
                {sendError}{' '}
                <a href={mailtoUrl} className="underline font-semibold">Email us instead</a>.
              </p>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={sending}>
                Cancel
              </Button>
              <Button type="submit" disabled={sending || (TURNSTILE_ENABLED && !turnstileToken)}>
                {sending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending…</>
                ) : mode === 'notify' ? (
                  <><Bell className="w-4 h-4 mr-2" />Notify me</>
                ) : (
                  <><Send className="w-4 h-4 mr-2" />Send enquiry</>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ShopEnquiryDialog;
