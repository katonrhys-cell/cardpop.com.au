// The areas of the Community section — one list read by the header's
// Community mega-menu (desktop + mobile) and by the Community Hub page
// (`pages/community/CommunityPage.jsx`), so the hub always mirrors the menu:
// add an area here and both grow together.
import { MessageSquare, Award, Users, BadgeCheck, MapPin, Ticket, Handshake, Store, BookOpen } from 'lucide-react';
import WhatnotIcon from '@/components/WhatnotIcon.jsx';

export const COMMUNITY_ITEMS = [
  { href: '/community/forum',          label: 'Forum',                 desc: 'Discussions and community posts',        Icon: MessageSquare, gradient: 'from-violet-500 to-purple-600'  },
  { href: '/community/leaderboard',    label: 'Leaderboard',           desc: 'Monthly points for active collectors',   Icon: Award,         gradient: 'from-amber-500 to-orange-500'   },
  { href: '/community/profiles',       label: 'Profiles',              desc: 'Browse collector profiles',              Icon: Users,         gradient: 'from-emerald-500 to-teal-600'   },
  // Local Traders carries the verified-badge colour rather than a Tailwind
  // gradient so the icon matches the badge it stands for — see badgeStyle().
  { href: '/community/local-traders',  label: 'Local Traders',         desc: 'Endorsed sellers near you',              Icon: BadgeCheck,    gradient: 'from-blue-500 to-cyan-600', isVerifiedBadge: true },
  { href: '/community/map',            label: 'Community Map',         desc: 'Stores, shows & traders near you',       Icon: MapPin,        gradient: 'from-blue-500 to-indigo-600'   },
  { href: '/community/whatnot',        label: 'Whatnot',               desc: 'Live buying and selling shows',          Icon: WhatnotIcon,   gradient: 'from-green-500 to-emerald-600', isWhatnot: true },
];

export const EVENT_ITEMS = [
  { href: '/events/card-shows',       label: 'Card Shows',       desc: 'Trading card fairs and expos',        Icon: Ticket,    gradient: 'from-red-500 to-rose-600'      },
  { href: '/events/trade-events',     label: 'Trade Events',     desc: 'Swap meets and trading nights',       Icon: Handshake, gradient: 'from-blue-500 to-indigo-600'   },
  { href: '/events/community-events', label: 'Community Events', desc: 'Collector meetups and community fun', Icon: Users,     gradient: 'from-violet-500 to-purple-600' },
  { href: '/events/store-events',     label: 'Store Events',     desc: 'Local game store tournaments',        Icon: Store,     gradient: 'from-amber-500 to-orange-500'  },
];

export const READS_ITEM = {
  href: '/blog', label: 'The Parallel Report', desc: 'Guides, news and card stories', Icon: BookOpen, gradient: 'from-blue-500 to-indigo-600',
};

// Class + inline style for an item's icon tile. Whatnot sits on black (its
// brand), Local Traders on the verified-badge colour, everything else on its
// gradient.
export const badgeStyle = (item) => {
  if (item.isWhatnot) return { className: 'bg-black', style: undefined };
  if (item.isVerifiedBadge) {
    return { className: '', style: { backgroundImage: 'linear-gradient(to bottom right, hsl(var(--verified-badge)), hsl(199 95% 35%))' } };
  }
  return { className: `bg-gradient-to-br ${item.gradient}`, style: undefined };
};
