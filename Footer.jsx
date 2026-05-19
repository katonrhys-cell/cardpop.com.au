import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  // Note: ScrollToTop component in App.jsx automatically handles scrolling to top on route changes,
  // so manual onClick handlers are no longer needed here, ensuring cleaner routing architecture.

  return (
    <footer className="bg-secondary/30 text-foreground pt-20 pb-10 mt-auto border-t border-border">
      <div className="container-default">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-12 mb-16">
          <div className="lg:col-span-2">
            <div className="bg-foreground px-4 py-2 rounded-xl inline-block mb-6">
              <span className="font-heading text-xl font-bold text-background tracking-tight">
                Card<span className="text-primary">Pop</span>
              </span>
            </div>
            <p className="text-muted-foreground text-sm max-w-sm leading-relaxed mb-6">
              The premier destination for collecting, trading, and analyzing trading cards and sports memorabilia.
            </p>
          </div>
          
          <div>
            <h4 className="font-bold mb-6 uppercase tracking-wider text-sm">Explore</h4>
            <ul className="space-y-4 text-sm text-muted-foreground font-medium">
              <li><Link to="/shop" className="hover:text-primary transition-colors">Shop</Link></li>
              <li><Link to="/marketplace" className="hover:text-primary transition-colors">Marketplace</Link></li>
              <li><Link to="/markets" className="hover:text-primary transition-colors">Market Analytics</Link></li>
              <li><Link to="/grading" className="hover:text-primary transition-colors">Grading Hub</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-6 uppercase tracking-wider text-sm">Connect</h4>
            <ul className="space-y-4 text-sm text-muted-foreground font-medium">
              <li><Link to="/blog" className="hover:text-primary transition-colors">Blog</Link></li>
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
              <li><Link to="/trust-safety" className="hover:text-primary transition-colors">Trust & Safety</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border pt-8 flex justify-between items-center">
          <p className="text-muted-foreground text-sm font-medium">
            © {new Date().getFullYear()} CardPop. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;