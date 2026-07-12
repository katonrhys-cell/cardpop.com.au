import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Trash2, ShieldCheck, Mail } from 'lucide-react';
import SEOHead from '@/components/SEOHead.jsx';
import InfoPageLayout from '@/components/InfoPageLayout.jsx';

const DataDeletionPage = () => {
  const [searchParams] = useSearchParams();
  // A Facebook data deletion callback points users here with a confirmation
  // code (e.g. /data-deletion?code=abc123 or ?id=abc123) so they can check the
  // status of their request.
  const confirmationCode = searchParams.get('code') || searchParams.get('id');

  return (
    <InfoPageLayout
      icon={Trash2}
      eyebrow="Your Privacy"
      title="Data Deletion Request"
      description="How to request that CardPop™ permanently deletes the personal data we hold about you."
    >
      <SEOHead
        title="Data Deletion Request | CardPop™"
        description="Request permanent deletion of the personal data CardPop™ holds about you, and track the status of an existing request."
      />

      <p className="text-sm text-muted-foreground mb-8">Last Updated: July 12, 2026</p>

      {confirmationCode && (
        <div className="not-prose mb-10 rounded-2xl border border-primary/20 bg-primary/5 p-6">
          <div className="flex items-center gap-3 mb-2">
            <ShieldCheck className="w-6 h-6 text-primary shrink-0" />
            <h2 className="text-xl font-bold m-0">Request Status</h2>
          </div>
          <p className="text-muted-foreground mb-4">
            We have received your data deletion request. Your confirmation number is:
          </p>
          <p className="font-mono text-lg font-bold tracking-wider bg-background border border-border rounded-lg px-4 py-3 inline-block">
            {confirmationCode}
          </p>
          <p className="text-muted-foreground mt-4 mb-0">
            <strong>Status: In progress.</strong> Your request is being processed and your data
            will be permanently deleted within 30 days. If you need an update, contact us at{' '}
            <a href="mailto:privacy@cardpop.com.au" className="text-primary font-semibold">
              privacy@cardpop.com.au
            </a>{' '}
            and quote your confirmation number above.
          </p>
        </div>
      )}

      <h2>Your Right to Deletion</h2>
      <p>
        At CardPop™ we believe you should stay in control of your personal information. In line
        with the Australian Privacy Principles and Meta's Platform Terms, you can ask us at any time
        to permanently delete the data we hold about you. This page explains how to make that
        request and how to check on its progress.
      </p>

      <h2>What Data We Delete</h2>
      <p>
        When you request deletion, we remove the personal information associated with your account,
        including your profile details, contact information, addresses, and any identifiers we
        received from third-party sign-in providers such as Facebook Login. Some records may be
        retained where we are legally required to keep them (for example, transaction and tax
        records for completed orders), and these are held only for as long as the law requires.
      </p>

      <h2>How to Request Deletion</h2>
      <p>You can request that your CardPop™ data be deleted in any of the following ways.</p>

      <h3>1. From your CardPop™ account</h3>
      <p>
        Sign in and go to your{' '}
        <a href="/account/profile" className="text-primary font-semibold">Profile Settings</a>.
        From there you can request account and data deletion directly.
      </p>

      <h3>2. By email</h3>
      <p>
        Send a request to{' '}
        <a href="mailto:privacy@cardpop.com.au" className="text-primary font-semibold">
          privacy@cardpop.com.au
        </a>{' '}
        from the email address associated with your account, with the subject line
        &ldquo;Data Deletion Request&rdquo;. We may ask you to verify your identity before we
        action the request.
      </p>

      <h3>3. Through Facebook</h3>
      <p>
        If you created your account using Facebook Login, you can request deletion directly from
        Facebook:
      </p>
      <ol>
        <li>Go to your Facebook <strong>Settings &amp; Privacy</strong> &gt; <strong>Settings</strong>.</li>
        <li>Select <strong>Apps and Websites</strong>.</li>
        <li>Find and select <strong>CardPop</strong> in your list of connected apps.</li>
        <li>Click <strong>Remove</strong>, then confirm by choosing <strong>Send Request</strong> to have your data deleted.</li>
      </ol>
      <p>
        Facebook will notify us of your request. We will begin deleting your data and provide a
        confirmation number you can use to track the status of your request on this page.
      </p>

      <h2>Checking the Status of a Request</h2>
      <p>
        Every deletion request is assigned a unique confirmation number. If you followed a link
        from Facebook or from a confirmation email, the status of your request and your confirmation
        number will appear at the top of this page. You can also quote that number when contacting
        our support team for an update.
      </p>

      <h2>How Long It Takes</h2>
      <p>
        We action deletion requests promptly and complete them within 30 days. If your request is
        delayed or cannot be fully actioned (for example, where we are legally required to retain
        certain records), we will explain the reason and let you know which data has been removed.
      </p>

      <div className="not-prose mt-10 flex items-start gap-3 rounded-2xl border border-border bg-secondary/30 p-6">
        <Mail className="w-6 h-6 text-primary shrink-0 mt-0.5" />
        <p className="text-muted-foreground m-0">
          Questions about your data or a deletion request? Email us at{' '}
          <a href="mailto:privacy@cardpop.com.au" className="text-primary font-semibold">
            privacy@cardpop.com.au
          </a>{' '}
          or read our{' '}
          <a href="/privacy" className="text-primary font-semibold">Privacy Policy</a>.
        </p>
      </div>
    </InfoPageLayout>
  );
};

export default DataDeletionPage;
