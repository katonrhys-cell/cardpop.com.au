import React from 'react';
import { Helmet } from 'react-helmet';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import InfoPageLayout from '@/components/InfoPageLayout.jsx';

const ContactPage = () => {
  return (
    <InfoPageLayout 
      title="Contact Us" 
      description="We're here to help. Send us a message and we'll respond as soon as possible."
      breadcrumbs={[{ label: 'Contact' }]}
    >
      <Helmet>
        <title>Contact Us | CardPop</title>
      </Helmet>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div>
          <h3>Get in Touch</h3>
          <p>
            Whether you have a question about an order, need help with your vault, or just want to share feedback, our team is ready to assist you.
          </p>
          
          <div className="mt-8 space-y-4">
            <div>
              <strong>Email Support</strong>
              <p className="text-muted-foreground">support@cardpop.com.au</p>
            </div>
            <div>
              <strong>Business Hours</strong>
              <p className="text-muted-foreground">Monday - Friday: 9am - 5pm AEST</p>
            </div>
          </div>
        </div>
        
        <Card className="shadow-sm">
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" placeholder="Your name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="Your email address" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" placeholder="How can we help?" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <textarea 
                id="message" 
                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Provide details about your inquiry..."
              ></textarea>
            </div>
            <Button className="w-full">Send Message</Button>
          </CardContent>
        </Card>
      </div>
    </InfoPageLayout>
  );
};

export default ContactPage;