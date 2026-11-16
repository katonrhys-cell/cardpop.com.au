import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';

// The desktop nav row as it looks before the real menus (HeaderMenus.jsx, a
// lazy chunk) have loaded: the same seven labels, in the same order and with
// the same classes, as plain links to each section's hub page.
//
// Header.jsx renders this as the Suspense fallback for <DesktopNavMenus/>, and
// tools/home-shell.html carries the identical markup in the static shell. So
// the row reads the same in all three stages — static HTML, React's first
// commit, and the real menus — where it used to show the old nine labels, go
// blank while the chunk loaded, then come back with seven different ones.
//
// Keep DESKTOP_NAV_PLACEHOLDER in step with DesktopNavMenus (the labels come
// from NAV_LINKS plus the Buy Cards and More dropdowns) and with the shell's
// row 2 — tests/frontend/homeShell.test.js checks all three.
export const DESKTOP_NAV_PLACEHOLDER = [
  { label: 'Buy Cards', href: '/marketplace', menu: true, feature: 'enable_marketplace' },
  { label: 'Supplies', href: '/shop', menu: true },
  { label: 'Sell', href: '/vault/add', sell: true },
  { label: 'Prices', href: '/analytics', menu: true },
  { label: 'Community', href: '/community', menu: true },
  { label: 'Grading', href: '/grading', menu: true },
  { label: 'More', href: '/about', menu: true },
];

export const NAV_ITEM_CLASS = 'px-2 xl:px-3 py-2 rounded-lg text-[13px] xl:text-sm font-medium transition-all duration-200 whitespace-nowrap';

const HeaderNavPlaceholder = ({ settings }) => (
  <>
    {DESKTOP_NAV_PLACEHOLDER.map((item) => {
      if (item.feature && settings?.[item.feature] === false) return null;
      if (item.menu) {
        return (
          <div key={item.label} className="relative">
            <Link to={item.href} className={`flex items-center gap-1 ${NAV_ITEM_CLASS} text-muted-foreground`}>
              {item.label}
              <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>
        );
      }
      return (
        <Link key={item.label} to={item.href} className={`${NAV_ITEM_CLASS} ${item.sell ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
          {item.label}
        </Link>
      );
    })}
  </>
);

export default HeaderNavPlaceholder;
