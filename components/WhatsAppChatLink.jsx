import React from 'react';
import { useLocation } from 'react-router-dom';
import { trackEvent } from '@/lib/analytics.js';
import { whatsappChatUrl, whatsappMessageForPath } from '@/utils/whatsapp.js';

/**
 * A link that opens a WhatsApp chat with CardPop (click-to-chat, see
 * utils/whatsapp.js). The pre-typed message names the public page the visitor
 * is on, so the question arrives with its context. `placement` labels the GA4
 * `whatsapp_chat_click` event (footer, contact page…).
 */
const WhatsAppChatLink = ({ placement = 'link', children, ...props }) => {
  const { pathname } = useLocation();
  return (
    <a
      href={whatsappChatUrl(whatsappMessageForPath(pathname))}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackEvent('whatsapp_chat_click', { placement, page_path: pathname })}
      {...props}
    >
      {children}
    </a>
  );
};

export default WhatsAppChatLink;
