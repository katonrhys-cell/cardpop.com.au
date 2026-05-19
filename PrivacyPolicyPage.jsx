
import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from '@/components/ui/card';
import { 
  Accordion, 
  AccordionItem, 
  AccordionTrigger, 
  AccordionContent 
} from '@/components/ui/accordion';
import { Shield, Lock, FileText, Mail, ChevronRight } from 'lucide-react';

const PrivacyPolicyPage = () => {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const sections = [
    {
      id: "introduction",
      title: "1. Introduction",
      icon: <FileText className="w-5 h-5 text-primary" />,
      content: (
        <div className="space-y-4">
          <p>
            Welcome to CardPop. We respect your privacy and are committed to protecting your personal data. 
            This Privacy Policy explains how we collect, use, disclose, and safeguard your information when 
            you visit our platform, use our digital vault, or participate in our trading marketplace.
          </p>
          <div className="bg-muted p-4 rounded-xl border border-border mt-4">
            <ul className="space-y-2 text-sm text-muted-foreground font-medium">
              <li><strong>Effective Date:</strong> May 14, 2026</li>
              <li><strong>Last Updated:</strong> May 14, 2026</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: "information-we-collect",
      title: "2. Information We Collect",
      icon: <Shield className="w-5 h-5 text-primary" />,
      content: (
        <div className="space-y-4">
          <p>We collect several different types of information for various purposes to provide and improve our service to you.</p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li><strong className="text-foreground">Personal Identification:</strong> Name, email address, physical address, and phone number when you register or complete a transaction.</li>
            <li><strong className="text-foreground">Payment Information:</strong> Credit card details, billing address, and transaction history (processed securely via our payment partners).</li>
            <li><strong className="text-foreground">Browsing Data:</strong> IP address, browser type, device identifiers, and pages visited on our platform.</li>
            <li><strong className="text-foreground">Communication Data:</strong> Records of your interactions with our support team or other members on the platform.</li>
          </ul>
        </div>
      )
    },
    {
      id: "how-we-use",
      title: "3. How We Use Your Information",
      content: (
        <div className="space-y-4">
          <p>We use your collected data to operate the CardPop marketplace securely and efficiently.</p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li><strong className="text-foreground">Service Delivery:</strong> To manage your account, process orders, facilitate trades, and provide customer support.</li>
            <li><strong className="text-foreground">Platform Improvements:</strong> To analyze usage patterns and optimize our website's functionality and user experience.</li>
            <li><strong className="text-foreground">Marketing & Updates:</strong> To send you promotional materials, newsletters, and platform updates (only with your explicit consent).</li>
            <li><strong className="text-foreground">Fraud Prevention:</strong> To monitor for suspicious activity, verify identities, and protect against unauthorized transactions.</li>
            <li><strong className="text-foreground">Legal Compliance:</strong> To comply with applicable laws, regulations, and reporting requirements.</li>
          </ul>
        </div>
      )
    },
    {
      id: "data-sharing",
      title: "4. Data Sharing and Disclosure",
      content: (
        <div className="space-y-4">
          <p>We do not sell your personal data. We only share your information in the following circumstances:</p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li><strong className="text-foreground">Service Providers:</strong> With trusted third-party vendors who perform services on our behalf (e.g., Stripe for payments, shipping carriers).</li>
            <li><strong className="text-foreground">Legal Requirements:</strong> If required by law, court order, or government request to protect our legal rights or the safety of our users.</li>
            <li><strong className="text-foreground">Business Transfers:</strong> In connection with a merger, acquisition, or sale of company assets, where data is transferred as a business asset.</li>
            <li><strong className="text-foreground">User Consent:</strong> When you explicitly authorize us to share your information with a third party.</li>
          </ul>
        </div>
      )
    },
    {
      id: "data-security",
      title: "5. Data Security",
      icon: <Lock className="w-5 h-5 text-primary" />,
      content: (
        <div className="space-y-4">
          <p>The security of your data is paramount. We implement robust measures to prevent unauthorized access, alteration, disclosure, or destruction of your personal information.</p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li><strong className="text-foreground">Encryption:</strong> All sensitive data is encrypted in transit using industry-standard TLS protocols.</li>
            <li><strong className="text-foreground">Access Controls:</strong> Strict role-based access limits who within our organization can view user data.</li>
            <li><strong className="text-foreground">Limitations:</strong> While we use commercially acceptable means to protect your personal data, no method of transmission over the internet or electronic storage is 100% secure.</li>
          </ul>
        </div>
      )
    },
    {
      id: "your-rights",
      title: "6. Your Privacy Rights",
      content: (
        <div className="space-y-4">
          <p>Depending on your location, you may have specific rights regarding your personal information:</p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li><strong className="text-foreground">Access & Correction:</strong> The right to view and edit the personal data we hold about you.</li>
            <li><strong className="text-foreground">Deletion:</strong> The right to request the deletion of your account and associated personal data ("Right to be Forgotten").</li>
            <li><strong className="text-foreground">Opt-Out:</strong> The right to unsubscribe from marketing communications at any time.</li>
            <li><strong className="text-foreground">Data Portability:</strong> The right to request a copy of your data in a structured, machine-readable format.</li>
          </ul>
          <p className="text-sm mt-4">To exercise any of these rights, please contact us at privacy@cardpop.com.</p>
        </div>
      )
    },
    {
      id: "cookies",
      title: "7. Cookies and Tracking Technologies",
      content: (
        <div className="space-y-4">
          <p>We use cookies and similar tracking technologies to track activity on our platform and hold certain information.</p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li><strong className="text-foreground">Essential Cookies:</strong> Required for the platform to function (e.g., maintaining your logged-in session).</li>
            <li><strong className="text-foreground">Analytical Cookies:</strong> Help us understand how visitors interact with the site to improve performance.</li>
            <li><strong className="text-foreground">Management:</strong> You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, some portions of our service may be inaccessible if you decline essential cookies.</li>
          </ul>
        </div>
      )
    },
    {
      id: "third-party",
      title: "8. Third-Party Links and Services",
      content: (
        <div className="space-y-4">
          <p>
            Our service may contain links to other websites that are not operated by us. If you click on a third-party link, 
            you will be directed to that third party's site. We strongly advise you to review the Privacy Policy of every site you visit. 
            We have no control over and assume no responsibility for the content, privacy policies, or practices of any third-party sites or services.
          </p>
        </div>
      )
    },
    {
      id: "childrens-privacy",
      title: "9. Children's Privacy",
      content: (
        <div className="space-y-4">
          <p>
            CardPop does not knowingly collect personally identifiable information from anyone under the age of 18. 
            Our platform is intended for adult collectors and traders. If you are a parent or guardian and you are aware 
            that your child has provided us with personal data, please contact us. If we become aware that we have collected 
            personal data from a minor without verification of parental consent, we take steps to remove that information from our servers.
          </p>
        </div>
      )
    },
    {
      id: "international-transfers",
      title: "10. International Data Transfers",
      content: (
        <div className="space-y-4">
          <p>
            Your information, including personal data, may be transferred to — and maintained on — computers located outside 
            of your state, province, country, or other governmental jurisdiction where data protection laws may differ.
          </p>
          <p className="text-muted-foreground">
            For users in the European Economic Area (EEA) or UK, we ensure compliance with GDPR by using standard contractual 
            clauses and requiring our infrastructure partners to adhere to recognized data transfer mechanisms.
          </p>
        </div>
      )
    },
    {
      id: "data-retention",
      title: "11. Data Retention",
      content: (
        <div className="space-y-4">
          <p>
            We will retain your personal data only for as long as is necessary for the purposes set out in this Privacy Policy. 
            We will retain and use your information to the extent necessary to comply with our legal obligations, resolve disputes, 
            and enforce our legal agreements and policies.
          </p>
          <p className="text-muted-foreground">
            Account data is typically deleted within 30 days of a formal deletion request, barring any ongoing disputes or legal holds.
          </p>
        </div>
      )
    },
    {
      id: "contact-us",
      title: "12. Contact Us",
      icon: <Mail className="w-5 h-5 text-primary" />,
      content: (
        <div className="space-y-4">
          <p>If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please reach out to us:</p>
          <div className="bg-muted p-6 rounded-xl border border-border space-y-3">
            <p><strong className="text-foreground">Email:</strong> <a href="mailto:privacy@cardpop.com" className="text-primary hover:underline">privacy@cardpop.com</a></p>
            <p><strong className="text-foreground">Support:</strong> <a href="mailto:support@cardpop.com" className="text-primary hover:underline">support@cardpop.com</a></p>
            <p><strong className="text-foreground">Mailing Address:</strong></p>
            <address className="text-muted-foreground not-italic pl-4 border-l-2 border-primary/30">
              CardPop Privacy Team<br />
              123 Trading Lane, Suite 400<br />
              Melbourne, VIC 3000<br />
              Australia
            </address>
            <p className="text-sm text-muted-foreground mt-4 pt-4 border-t border-border/50">
              We aim to respond to all privacy-related inquiries within 48-72 business hours.
            </p>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-background font-sans flex flex-col">
      <Helmet>
        <title>Privacy Policy | CardPop</title>
        <meta name="description" content="Read CardPop's Privacy Policy to understand how we collect, use, and safeguard your personal information and trading data." />
      </Helmet>

      {/* Header Section */}
      <section className="bg-card border-b border-border py-16 md:py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background pointer-events-none" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-6 shadow-inner">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold font-serif mb-6 text-foreground tracking-tight text-balance">
            Privacy Policy
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto text-balance leading-relaxed">
            Your trust is our top priority. Learn how we handle your data with transparency, care, and industry-leading security.
          </p>
          
          <div className="flex items-center justify-center gap-2 mt-8 text-sm font-medium text-muted-foreground">
            <Link to="/" className="hover:text-primary transition-colors">Home</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-foreground">Privacy Policy</span>
          </div>
        </div>
      </section>

      {/* Content Section */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 w-full flex-grow">
        <Card className="border-border shadow-lg rounded-[2rem] overflow-hidden bg-card">
          <CardHeader className="bg-muted/30 border-b border-border p-8 md:p-10">
            <CardTitle className="text-2xl font-bold tracking-tight">Data Protection Agreement</CardTitle>
            <CardDescription className="text-base text-balance mt-2">
              Please review the terms below to understand our practices regarding your personal information.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 md:p-10">
            <Accordion type="single" collapsible defaultValue="introduction" className="w-full space-y-4">
              {sections.map((section) => (
                <AccordionItem 
                  key={section.id} 
                  value={section.id}
                  className="border border-border rounded-xl px-2 sm:px-6 bg-background data-[state=open]:border-primary/50 data-[state=open]:shadow-sm transition-all duration-300"
                >
                  <AccordionTrigger className="text-lg font-bold hover:no-underline py-5 text-left gap-4 hover:text-primary transition-colors">
                    <div className="flex items-center gap-3 flex-1">
                      {section.icon}
                      <span>{section.title}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="text-base leading-relaxed text-foreground pb-6">
                    {section.content}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default PrivacyPolicyPage;
