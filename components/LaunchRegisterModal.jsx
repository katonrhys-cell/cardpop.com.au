import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Sparkles, Repeat, Bell, Star } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import NewsletterSignup from '@/components/NewsletterSignup.jsx';
import CardPopLogo from '@/components/CardPopLogo.jsx';

// Bump the version suffix to re-show the modal to everyone (e.g. after a big
// messaging change). Stored value is 'dismissed' or 'registered'.
const STORAGE_KEY = 'cardpop_launch_modal_v1';

// Routes where the modal would be redundant or intrusive. /launch already has
// its own full-page registration form; auth pages are mid-flow.
const SUPPRESSED_PREFIXES = ['/launch', '/login', '/signup', '/reset-password', '/forgot-password'];

const BENEFITS = [
  { Icon: Star, text: 'Reserve free Pro-level early access' },
  { Icon: Bell, text: 'Be first to know the moment we go live' },
  { Icon: Repeat, text: 'Early access to P2P trading & more as it rolls out' },
];

const LaunchRegisterModal = () => {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (SUPPRESSED_PREFIXES.some((p) => pathname.startsWith(p))) return;

    let seen = null;
    try {
      seen = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // localStorage can throw in private mode — just show the modal.
    }
    if (seen) return;

    // Open on the visitor's first interaction, with a timed fallback a few
    // seconds AFTER the load event for visitors who never touch the page.
    // The old fixed 1.2s-after-navigation timer landed mid-load: the dialog's
    // render/layout work joined the initial-load main-thread window (hurting
    // TBT/Speed Index) and interrupted people before the page had settled.
    // Scroll only (not pointerdown/tap): popping a dialog at the instant of a
    // click would land it under the visitor's finger and swallow the tap.
    let opened = false;
    let timer = null;
    const interactionEvents = ['scroll', 'wheel'];

    const cleanup = () => {
      for (const evt of interactionEvents) window.removeEventListener(evt, openOnce);
      window.removeEventListener('load', armFallback);
      if (timer) clearTimeout(timer);
    };
    const openOnce = () => {
      if (opened) return;
      opened = true;
      cleanup();
      setOpen(true);
    };
    const armFallback = () => { timer = setTimeout(openOnce, 6000); };

    for (const evt of interactionEvents) {
      window.addEventListener(evt, openOnce, { once: true, passive: true });
    }
    if (document.readyState === 'complete') {
      armFallback();
    } else {
      window.addEventListener('load', armFallback, { once: true });
    }
    return cleanup;
  }, [pathname]);

  const remember = (value) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Ignore — worst case the modal shows again next visit.
    }
  };

  const handleOpenChange = (next) => {
    setOpen(next);
    if (!next) remember('dismissed');
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-md overflow-hidden p-0 gap-0"
        // Don't autofocus the email input on open: it pops the keyboard on
        // mobile, and the focus event would arm the (intent-gated) reCAPTCHA
        // inside NewsletterSignup before the visitor has touched the form.
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Deep navy (not brand-charcoal #1F2937) so the red "Pop" clears WCAG
            AA contrast — red-on-charcoal is only 2.6:1, red on #0B1220 is 3.3:1.
            Matches the brand cover-image treatment (red mark on deep navy). */}
        <div className="flex justify-center bg-[#0B1220] px-6 pt-8 pb-7">
          <CardPopLogo variant="full" onDark iconClassName="w-9 h-[44px]" />
        </div>

        <div className="px-6 py-6">
          <DialogHeader className="space-y-2 text-center sm:text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-brand-red/10">
              <Sparkles className="h-5 w-5 text-brand-red" />
            </div>
            <DialogTitle className="text-xl font-bold">
              We're building something big — launching late 2026
            </DialogTitle>
            <DialogDescription className="text-sm">
              Register now for a limited time to secure <strong className="text-foreground">Pro-level early access</strong> and
              be first to explore CardPop as features go live. The marketplace and P2P trading aren't live just yet.
            </DialogDescription>
          </DialogHeader>

          <ul className="my-5 space-y-2.5">
            {BENEFITS.map(({ Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-foreground">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-red/10">
                  <Icon className="h-3.5 w-3.5 text-brand-red" />
                </span>
                {text}
              </li>
            ))}
          </ul>

          <NewsletterSignup
            list="launch"
            source="launch_modal"
            buttonLabel="Register"
            successMessage="You're in! Check your inbox for your early-access welcome."
            toastMessage="You're in! We've reserved your Pro early access — check your inbox."
            onSubscribed={() => remember('registered')}
          />

          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            className="mt-3 w-full text-center text-xs font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
          >
            Maybe later
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LaunchRegisterModal;
