import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell, DollarSign, Hammer, TrendingUp, TrendingDown, Clock, Award,
  Tag, CheckCircle2, XCircle, RefreshCw, MessageSquare, UserPlus,
  Star, ShieldCheck, ShieldAlert, Shield, Settings, Check, CalendarClock,
  ShoppingBag, UserCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/hooks/useNotifications.js';
import { formatDistanceToNow } from 'date-fns';

const TYPE_CONFIG = {
  listing_sold:             { icon: DollarSign,   color: 'text-emerald-500' },
  bid_placed:               { icon: Hammer,        color: 'text-amber-500' },
  bid_outbid:               { icon: TrendingUp,    color: 'text-red-500' },
  auction_ended:            { icon: Clock,         color: 'text-slate-500' },
  auction_ending_soon:      { icon: Clock,         color: 'text-orange-500' },
  auction_won:              { icon: Award,         color: 'text-yellow-500' },
  offer_received:           { icon: Tag,           color: 'text-blue-500' },
  offer_accepted:           { icon: CheckCircle2,  color: 'text-emerald-500' },
  offer_declined:           { icon: XCircle,       color: 'text-red-500' },
  offer_countered:          { icon: RefreshCw,     color: 'text-blue-500' },
  message:                  { icon: MessageSquare, color: 'text-blue-500' },
  follow:                   { icon: UserPlus,      color: 'text-purple-500' },
  review_received:          { icon: Star,          color: 'text-amber-500' },
  verification_approved:    { icon: ShieldCheck,   color: 'text-emerald-500' },
  verification_rejected:    { icon: ShieldAlert,   color: 'text-red-500' },
  security_alert:           { icon: Shield,        color: 'text-red-500' },
  watchlist_price_drop:     { icon: TrendingDown,  color: 'text-amber-500' },
  watchlist_bid:            { icon: Hammer,        color: 'text-amber-500' },
  watchlist_ending_soon:    { icon: Clock,         color: 'text-red-500' },
  event_pending_review:     { icon: CalendarClock, color: 'text-blue-500' },
  order_placed:             { icon: ShoppingBag,   color: 'text-emerald-500' },
  verification_requested:   { icon: UserCheck,     color: 'text-blue-500' },
  system:                   { icon: Bell,          color: 'text-slate-500' },
};

const NotificationItem = ({ notification, onRead }) => {
  const cfg = TYPE_CONFIG[notification.type] || TYPE_CONFIG.system;
  const Icon = cfg.icon;
  const timeAgo = formatDistanceToNow(new Date(notification.created_at), { addSuffix: true });

  const handleClick = () => {
    if (!notification.is_read) onRead(notification.id);
  };

  const inner = (
    <div
      className={`flex gap-3 p-3 rounded-xl cursor-pointer transition-colors hover:bg-muted/60 ${!notification.is_read ? 'bg-primary/5' : ''}`}
      onClick={handleClick}
    >
      <div className={`w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5`}>
        <Icon className={`w-4 h-4 ${cfg.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${!notification.is_read ? 'font-semibold text-foreground' : 'text-foreground/80'}`}>
          {notification.title}
        </p>
        {notification.body && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notification.body}</p>
        )}
        <p className="text-[10px] text-muted-foreground mt-1">{timeAgo}</p>
      </div>
      {!notification.is_read && (
        <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
      )}
    </div>
  );

  // The DB column is `link`; `action_url` kept as a legacy fallback.
  const href = notification.link || notification.action_url;
  if (href) {
    return <Link to={href} className="block">{inner}</Link>;
  }
  return inner;
};

const NotificationBell = () => {
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!panelRef.current?.contains(e.target) && !buttonRef.current?.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative">
      <Button
        ref={buttonRef}
        variant="ghost"
        size="icon"
        className="relative rounded-xl hover:bg-muted"
        aria-label="Notifications"
        onClick={() => setOpen(v => !v)}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px] bg-primary text-primary-foreground border-none font-bold tabular-nums shadow-sm">
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-2 w-[360px] max-h-[520px] bg-card border border-border rounded-2xl shadow-xl z-50 flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <h3 className="font-bold text-base">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-primary hover:underline font-medium flex items-center gap-1"
                >
                  <Check className="w-3 h-3" /> Mark all read
                </button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" asChild onClick={() => setOpen(false)}>
                <Link to="/account/notifications"><Settings className="w-3.5 h-3.5" /></Link>
              </Button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
            ) : notifications.length === 0 ? (
              <div className="p-10 text-center">
                <Bell className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-medium text-muted-foreground">You're all caught up!</p>
              </div>
            ) : (
              <div className="p-2 space-y-0.5">
                {notifications.map(n => (
                  <NotificationItem key={n.id} notification={n} onRead={(id) => { markRead(id); }} />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border p-2 shrink-0">
            <Link
              to="/account/notifications"
              className="block text-center text-xs font-bold text-primary hover:underline py-1"
              onClick={() => setOpen(false)}
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
