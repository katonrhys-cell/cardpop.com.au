import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import WhatsAppIcon from '@/components/WhatsAppIcon.jsx';
import WhatsAppChatLink from '@/components/WhatsAppChatLink.jsx';
import { BOTTOM_BAR_INSET_VAR } from '@/lib/bottomBarInset.js';

// Where the button stays away: the admin panel (staff would be messaging their
// own number) and the member inbox, whose message box and Send button sit in
// the same corner on a phone.
export const NO_CHAT_BUTTON_PREFIXES = ['/admin', '/messaging'];

export const showsChatButton = (pathname = '') =>
  !NO_CHAT_BUTTON_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/**
 * The round "Chat with us on WhatsApp" button pinned to the bottom-right of
 * every page (the Google reviews badge has the bottom-left). It is the same
 * click-to-chat link as the footer's — no widget script. It sits under dialogs,
 * drawers and the header (z-40), and lifts above any bottom bar that reports
 * its height through lib/bottomBarInset.js.
 */
const WhatsAppFloatingButton = () => {
  const { pathname } = useLocation();
  // The slide between heights is for a bar that appears or goes while the
  // button is on screen (the cookie banner being answered). On first paint the
  // banner's height is published in the same commit, and animating to it made
  // the button visibly glide up the corner on every first visit — so the
  // `bottom` transition is only switched on once the page has painted.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    let inner = 0;
    const outer = requestAnimationFrame(() => { inner = requestAnimationFrame(() => setSettled(true)); });
    return () => { cancelAnimationFrame(outer); cancelAnimationFrame(inner); };
  }, []);
  if (!showsChatButton(pathname)) return null;

  return (
    <WhatsAppChatLink
      placement="floating_button"
      aria-label="Chat with us on WhatsApp"
      title="Chat with us on WhatsApp"
      data-testid="whatsapp-floating-button"
      // WhatsApp green, a shade deeper than the logo's #25D366 so the white
      // glyph clears 3:1 contrast.
      className={`fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#1DA851] text-white shadow-lg shadow-black/20 ${settled ? 'transition-[bottom,transform,background-color]' : 'transition-[transform,background-color]'} duration-200 hover:scale-105 hover:bg-[#178C43] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none motion-reduce:hover:scale-100 sm:right-6 print:hidden`}
      style={{ bottom: `calc(1rem + env(safe-area-inset-bottom, 0px) + var(${BOTTOM_BAR_INSET_VAR}, 0px))` }}
    >
      <WhatsAppIcon className="h-7 w-7" />
    </WhatsAppChatLink>
  );
};

export default WhatsAppFloatingButton;
