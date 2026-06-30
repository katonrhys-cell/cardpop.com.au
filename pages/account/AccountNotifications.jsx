import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import {
  Bell, DollarSign, Hammer, TrendingUp, TrendingDown, Clock, Award,
  Tag, CheckCircle2, XCircle, RefreshCw, MessageSquare, UserPlus,
  Star, ShieldCheck, ShieldAlert, Shield, Settings, Check, Filter,
} from 'lucide-react';
import Breadcrumb from '@/components/Breadcrumb.jsx';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useNotifications } from '@/hooks/useNotifications.js';
import { formatDistanceToNow, format } from 'date-fns';

const TYPE_CONFIG = {
  listing_sold:             { icon: DollarSign,   color: 'text-emerald-500', bg: 'bg-emerald-500/10', label: 'Sale' },
  bid_placed:               { icon: Hammer,        color: 'text-amber-500',   bg: 'bg-amber-500/10',   label: 'Bid' },
  bid_outbid:               { icon: TrendingUp,    color: 'text-red-500',     bg: 'bg-red-500/10',     label: 'Outbid' },
  auction_ended:            { icon: Clock,         color: 'text-slate-500',   bg: 'bg-slate-500/10',   label: 'Auction' },
  auction_ending_soon:      { icon: Clock,         color: 'text-orange-500',  bg: 'bg-orange-500/10',  label: 'Auction' },
  auction_won:              { icon: Award,         color: 'text-yellow-500',  bg: 'bg-yellow-500/10',  label: 'Won' },
  offer_received:           { icon: Tag,           color: 'text-blue-500',    bg: 'bg-blue-500/10',    label: 'Offer' },
  offer_accepted:           { icon: CheckCircle2,  color: 'text-emerald-500', bg: 'bg-emerald-500/10', label: 'Offer' },
  offer_declined:           { icon: XCircle,       color: 'text-red-500',     bg: 'bg-red-500/10',     label: 'Offer' },
  offer_countered:          { icon: RefreshCw,     color: 'text-blue-500',    bg: 'bg-blue-500/10',    label: 'Offer' },
  message:                  { icon: MessageSquare, color: 'text-blue-500',    bg: 'bg-blue-500/10',    label: 'Message' },
  follow:                   { icon: UserPlus,      color: 'text-purple-500',  bg: 'bg-purple-500/10',  label: 'Follow' },
  review_received:          { icon: Star,          color: 'text-amber-500',   bg: 'bg-amber-500/10',   label: 'Review' },
  verification_approved:    { icon: ShieldCheck,   color: 'text-emerald-500', bg: 'bg-emerald-500/10', label: 'Account' },
  verification_rejected:    { icon: ShieldAlert,   color: 'text-red-500',     bg: 'bg-red-500/10',     label: 'Account' },
  security_alert:           { icon: Shield,        color: 'text-red-500',     bg: 'bg-red-500/10',     label: 'Security' },
  watchlist_price_drop:     { icon: TrendingDown,  color: 'text-amber-500',   bg: 'bg-amber-500/10',   label: 'Watchlist' },
  watchlist_bid:            { icon: Hammer,        color: 'text-amber-500',   bg: 'bg-amber-500/10',   label: 'Watchlist' },
  watchlist_ending_soon:    { icon: Clock,         color: 'text-red-500',     bg: 'bg-red-500/10',     label: 'Watchlist' },
  system:                   { icon: Bell,          color: 'text-slate-500',   bg: 'bg-slate-500/10',   label: 'System' },
};

const FILTERS = ['All', 'Unread', 'Sales', 'Bids', 'Offers', 'Messages', 'Watchlist', 'Account'];

const matchFilter = (n, filter) => {
  if (filter === 'All') return true;
  if (filter === 'Unread') return !n.is_read;
  const t = n.type || '';
  if (filter === 'Sales') return t.includes('sold') || t.includes('payment');
  if (filter === 'Bids') return t.includes('bid') || t.includes('auction');
  if (filter === 'Offers') return t.includes('offer');
  if (filter === 'Messages') return t === 'message';
  if (filter === 'Watchlist') return t.startsWith('watchlist');
  if (filter === 'Account') return ['follow','review_received','verification_approved','verification_rejected','security_alert','system'].includes(t);
  return true;
};

const NotificationRow = ({ notification, onRead }) => {
  const cfg = TYPE_CONFIG[notification.type] || TYPE_CONFIG.system;
  const Icon = cfg.icon;

  const inner = (
    <div
      className={`flex gap-4 p-4 rounded-xl border border-border transition-all cursor-pointer hover:border-primary/20 hover:shadow-sm ${!notification.is_read ? 'bg-primary/5 border-primary/20' : 'bg-card'}`}
      onClick={() => { if (!notification.is_read) onRead(notification.id); }}
    >
      <div className={`w-10 h-10 rounded-full ${cfg.bg} flex items-center justify-center shrink-0`}>
        <Icon className={`w-5 h-5 ${cfg.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm leading-snug ${!notification.is_read ? 'font-semibold' : ''}`}>
            {notification.title}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="text-[10px] font-bold px-1.5">{cfg.label}</Badge>
            {!notification.is_read && <div className="w-2 h-2 rounded-full bg-primary" />}
          </div>
        </div>
        {notification.body && (
          <p className="text-sm text-muted-foreground mt-0.5">{notification.body}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1.5">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
          <span className="mx-1">·</span>
          {format(new Date(notification.created_at), 'MMM d, h:mm a')}
        </p>
      </div>
    </div>
  );

  if (notification.action_url) {
    return <Link to={notification.action_url} className="block">{inner}</Link>;
  }
  return inner;
};

const AccountNotifications = () => {
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications();
  const [activeFilter, setActiveFilter] = useState('All');

  const filtered = notifications.filter(n => matchFilter(n, activeFilter));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Helmet><title>Notifications | CardPop</title></Helmet>
      <Breadcrumb items={[{ label: 'Account', path: '/account' }, { label: 'Notifications' }]} />

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold font-heading mb-1">Notifications</h1>
          <p className="text-muted-foreground">
            {loading ? 'Loading…' : unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" onClick={markAllRead} className="rounded-xl h-9 gap-2">
              <Check className="w-4 h-4" /> Mark all read
            </Button>
          )}
          <Button variant="outline" asChild className="rounded-xl h-9 gap-2">
            <Link to="/account/notification-settings">
              <Settings className="w-4 h-4" /> Settings
            </Link>
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeFilter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4 p-4 rounded-xl border border-border">
              <Skeleton className="w-10 h-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-16 text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-5">
            <Bell className="w-8 h-8 text-muted-foreground opacity-50" />
          </div>
          <h3 className="text-xl font-bold mb-2">
            {activeFilter === 'Unread' ? 'No unread notifications' : 'No notifications yet'}
          </h3>
          <p className="text-muted-foreground max-w-sm mx-auto">
            {activeFilter === 'All' ? "Activity on your listings, bids, and messages will appear here." : `No ${activeFilter.toLowerCase()} notifications.`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(n => (
            <NotificationRow key={n.id} notification={n} onRead={markRead} />
          ))}
        </div>
      )}
    </div>
  );
};

export default AccountNotifications;
