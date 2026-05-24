import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle, Send, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import InfoPageLayout from '@/components/InfoPageLayout.jsx';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  subject: z.string().min(3, 'Subject must be at least 3 characters'),
  message: z.string().min(20, 'Please write at least 20 characters so we can help you properly'),
});

const ContactPage = () => {
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = (data) => {
    const subject = encodeURIComponent(`[CardPop] ${data.subject}`);
    const body = encodeURIComponent(
      `Name: ${data.name}\nEmail: ${data.email}\n\nMessage:\n${data.message}`
    );
    window.open(`mailto:support@cardpop.com.au?subject=${subject}&body=${body}`);
    setSubmitted(true);
  };

  return (
    <InfoPageLayout
      title="Contact Us"
      description="We're here to help. Send us a message and we'll respond as soon as possible."
      breadcrumbs={[{ label: 'Contact' }]}
    >
      <Helmet>
        <title>Contact Us | CardPop</title>
      </Helmet>

      {submitted ? (
        <div className="text-center py-16 max-w-md mx-auto">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-2xl font-bold mb-3">Message ready to send!</h3>
          <p className="text-muted-foreground mb-8">
            Your email client has opened with your message pre-filled. Hit send and we'll get back to you within 1 business day (AEST).
          </p>
          <Button variant="outline" onClick={() => setSubmitted(false)}>
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
                <strong className="text-sm font-semibold">Business Hours</strong>
                <p className="text-muted-foreground text-sm mt-1">Monday – Friday: 9am – 5pm AEST</p>
              </div>
            </div>
          </div>

          <Card className="shadow-sm">
            <CardContent className="p-6">
              <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" placeholder="Your name" {...register('name')} />
                  {errors.name && (
                    <p className="text-destructive text-xs">{errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="Your email address" {...register('email')} />
                  {errors.email && (
                    <p className="text-destructive text-xs">{errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="subject">Subject</Label>
                  <Input id="subject" placeholder="How can we help?" {...register('subject')} />
                  {errors.subject && (
                    <p className="text-destructive text-xs">{errors.subject.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="message">Message</Label>
                  <textarea
                    id="message"
                    className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Provide details about your inquiry..."
                    {...register('message')}
                  />
                  {errors.message && (
                    <p className="text-destructive text-xs">{errors.message.message}</p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Send Message
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
