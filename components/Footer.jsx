import React from 'react';
import { Link } from 'react-router-dom';
import { Twitter, Instagram, Facebook, Youtube } from 'lucide-react';
import CardPopLogo from '@/components/CardPopLogo.jsx';
import NewsletterSignup from '@/components/NewsletterSignup.jsx';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext.jsx';

const DiscordIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);

const SOCIAL_LINKS = [
  { label: 'Discord', href: 'https://discord.gg/cardpop', Icon: DiscordIcon },
  { label: 'Twitter / X', href: 'https://twitter.com/cardpopau', Icon: Twitter },
  { label: 'Instagram', href: 'https://instagram.com/cardpopau', Icon: Instagram },
  { label: 'Facebook', href: 'https://www.facebook.com/profile.php?id=61591488466915', Icon: Facebook },
  { label: 'YouTube', href: 'https://youtube.com/@cardpopau', Icon: Youtube },
];

const Footer = () => {
  const { settings } = usePlatformSettings();
  return (
    <footer className="bg-secondary/30 text-foreground pt-12 pb-8 sm:pt-20 sm:pb-10 mt-auto border-t border-border">
      <div className="container-default">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10 sm:gap-12 mb-10 sm:mb-16">
          <div className="lg:col-span-2">
            <Link to="/" className="inline-block mb-6 text-2xl">
              <CardPopLogo variant="full" iconClassName="w-8 h-[39px]" />
            </Link>
            <p className="text-muted-foreground text-sm max-w-sm leading-relaxed mb-6">
              The premier destination for collecting, trading, and analyzing trading cards and sports memorabilia.
            </p>

            {/* Newsletter signup */}
            <div className="mb-6">
              <p className="text-sm font-bold uppercase tracking-wider mb-3">Stay in the Loop</p>
              <NewsletterSignup />
            </div>

            {/* Social icons */}
            <div className="flex items-center gap-3">
              {SOCIAL_LINKS.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-muted/70 transition-colors"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-bold mb-6 uppercase tracking-wider text-sm">Explore</h4>
            <ul className="space-y-4 text-sm text-muted-foreground font-medium">
              <li><Link to="/shop" className="hover:text-primary transition-colors">Shop</Link></li>
              {settings.enable_marketplace !== false && (
                <li><Link to="/marketplace" className="hover:text-primary transition-colors">Marketplace</Link></li>
              )}
              <li><Link to="/analytics" className="hover:text-primary transition-colors">Analytics</Link></li>
              <li><Link to="/prices" className="hover:text-primary transition-colors">Card Prices (AUD)</Link></li>
              <li><Link to="/card-shops" className="hover:text-primary transition-colors">Card Shop Directory</Link></li>
              <li><Link to="/grading" className="hover:text-primary transition-colors">Grading Hub</Link></li>
              <li><Link to="/safe-buying" className="hover:text-primary transition-colors">Safe Buying Guide</Link></li>
              <li><Link to="/photography-standard" className="hover:text-primary transition-colors">Photography Guide</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-6 uppercase tracking-wider text-sm">Connect</h4>
            <ul className="space-y-4 text-sm text-muted-foreground font-medium">
              {settings.enable_blog !== false && (
                <>
                  <li><Link to="/blog" className="hover:text-primary transition-colors">Blog</Link></li>
                  <li><Link to="/conviction-rating" className="hover:text-primary transition-colors">Conviction Rating</Link></li>
                </>
              )}
              <li><Link to="/community" className="hover:text-primary transition-colors">Community</Link></li>
              <li><Link to="/about" className="hover:text-primary transition-colors">About Us</Link></li>
              <li><Link to="/contact" className="hover:text-primary transition-colors">Contact</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-6 uppercase tracking-wider text-sm">Account & Legal</h4>
            <ul className="space-y-4 text-sm text-muted-foreground font-medium">
              <li><Link to="/login" className="hover:text-primary transition-colors">Sign In</Link></li>
              <li><Link to="/signup" className="hover:text-primary transition-colors">Create Account</Link></li>
              <li><Link to="/account" className="hover:text-primary transition-colors">My Dashboard</Link></li>
              <li><Link to="/account/profile" className="hover:text-primary transition-colors">Profile Settings</Link></li>
              <li><Link to="/terms" className="hover:text-primary transition-colors">Terms of Service</Link></li>
              <li><Link to="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
              <li><Link to="/data-deletion" className="hover:text-primary transition-colors">Data Deletion</Link></li>
              <li><Link to="/trust-safety" className="hover:text-primary transition-colors">Trust & Safety</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-muted-foreground text-sm font-medium">
            © {new Date().getFullYear()} CardPop™ Australia. All rights reserved.
          </p>
          <p className="text-muted-foreground text-sm">
            Made with ❤️ for the Australian trading card community
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
