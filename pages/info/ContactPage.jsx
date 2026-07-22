import React, { useState } from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { CheckCircle, Send, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import InfoPageLayout from '@/components/InfoPageLayout.jsx';
import apiServerClient from '@/lib/apiServerClient.js';

const validate = ({ name, email, subject, message }) => {
  const errors = {};
  if (!name || name.trim().length < 2) errors.name = 'Name must be at least 2 characters';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Please enter a valid email address';
  if (!subject || subject.trim().length < 3) errors.subject = 'Subject must be at least 3 characters';
  if (!message || message.trim().length < 20) errors.message = 'Please write at least 20 characters so we can help you properly';
  return errors;
};

const EMPTY = { name: '', email: '', subject: '', message: '', company: '' };

const ContactPage = () => {
  const [fields, setFields] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  // Fallback mailto for the error path, so the visitor is never stranded if the
  // server send fails.
  const mailtoUrl = `mailto:support@cardpop.com.au?subject=${encodeURIComponent(`[CardPop] ${fields.subject || ''}`)}` +
    `&body=${encodeURIComponent(`Name: ${fields.name}\nEmail: ${fields.email}\n\nMessage:\n${fields.message}`)}`;

  const update = (key, value) => {
    setFields(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }));
    if (sendError) setSendError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate(fields);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSending(true);
    setSendError('');
    try {
      const res = await apiServerClient.fetch('/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fields.name.trim(),
          email: fields.email.trim(),
          subject: fields.subject.trim(),
          message: fields.message.trim(),
          company: fields.company, // honeypot — real users leave this blank
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSendError(data.error || 'We could not send your message. Please try again.');
        return;
      }
      setSubmitted(true);
    } catch {
      setSendError('We could not reach the server. Please check your connection and try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <InfoPageLayout
      title="Contact Us"
      description="We're here to help. Send us a message and we'll respond as soon as possible."
      breadcrumbs={[{ label: 'Contact' }]}
    >
      <SEOHead title="Contact Us | CardPop" description="Get in touch with the CardPop team. We're here to help with buying, selling, trading and grading questions." />

      {submitted ? (
        <div className="text-center py-16 max-w-md mx-auto">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-2xl font-bold mb-3">Message sent!</h3>
          <p className="text-muted-foreground mb-6">
            Thanks for reaching out — we've received your message and will get back to you within 1 business day (AEST).
          </p>
          <p className="text-sm text-muted-foreground mb-8">
            Prefer email? You can always reach us directly at{' '}
            <a href="mailto:support@cardpop.com.au" className="text-primary font-semibold hover:underline">support@cardpop.com.au</a>.
          </p>
          <Button variant="outline" onClick={() => { setSubmitted(false); setFields(EMPTY); setSendError(''); }}>
            Send another message
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div>
            <h3 className="text-xl font-bold mb-3">Get in Touch</h3>
            <p className="text-muted-foreground leading-relaxed">
              Whether you have a question about an order, need help with your vault, or just want to share feedback, our team is ready to assist you.
            </p>
            <div className="mt-8 space-y-4">
              <div>
                <strong className="text-sm font-semibold">Email Support</strong>
                <p className="text-muted-foreground text-sm mt-1">support@cardpop.com.au</p>
              </div>
              <div>
                <strong className="text-sm font-semibold">Admin Email</strong>
                <p className="text-muted-foreground text-sm mt-1">admin@cardpop.com.au</p>
              </div>
              <div>
                <strong className="text-sm font-semibold">Mailing Address</strong>
                <p className="text-muted-foreground text-sm mt-1">
                  PO Box 1024<br />
                  ASCOT VALE VICTORIA 3032
                </p>
              </div>
              <div>
                <strong className="text-sm font-semibold">Business Hours</strong>
                <p className="text-muted-foreground text-sm mt-1">Monday – Friday: 9am – 5pm AEST</p>
              </div>
            </div>
          </div>

          <Card className="shadow-sm">
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="Your name"
                    value={fields.name}
                    onChange={e => update('name', e.target.value)}
                  />
                  {errors.name && <p className="text-destructive text-xs">{errors.name}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Your email address"
                    value={fields.email}
                    onChange={e => update('email', e.target.value)}
                  />
                  {errors.email && <p className="text-destructive text-xs">{errors.email}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    placeholder="How can we help?"
                    value={fields.subject}
                    onChange={e => update('subject', e.target.value)}
                  />
                  {errors.subject && <p className="text-destructive text-xs">{errors.subject}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="message">Message</Label>
                  <textarea
                    id="message"
                    className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Provide details about your inquiry..."
                    value={fields.message}
                    onChange={e => update('message', e.target.value)}
                  />
                  {errors.message && <p className="text-destructive text-xs">{errors.message}</p>}
                </div>

                {/* Honeypot — hidden from real users; bots that fill it are dropped server-side */}
                <div className="hidden" aria-hidden="true">
                  <label htmlFor="company">Company</label>
                  <input
                    id="company"
                    name="company"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={fields.company}
                    onChange={e => update('company', e.target.value)}
                  />
                </div>

                {sendError && (
                  <p className="text-destructive text-sm" role="alert">
                    {sendError}{' '}
                    <a href={mailtoUrl} className="font-semibold underline hover:no-underline">Email us instead</a>.
                  </p>
                )}

                <Button type="submit" className="w-full" disabled={sending}>
                  {sending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending…</>
                  ) : (
                    <><Send className="w-4 h-4 mr-2" /> Send Message</>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </InfoPageLayout>
  );
};

export default ContactPage;
