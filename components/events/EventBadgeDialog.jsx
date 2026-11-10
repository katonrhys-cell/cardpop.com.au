import React from 'react';
import WebsiteBadgeDialog from '@/components/WebsiteBadgeDialog.jsx';
import { eventBadgeSnippet } from '@/utils/eventBadge.js';

// "Listed on CardPop" badge for an organiser's own website — a link from
// their site to the event page (utils/eventBadge.js).
const EventBadgeDialog = ({ event, onClose }) => (
  <WebsiteBadgeDialog
    open={Boolean(event)}
    onClose={onClose}
    kind="event"
    snippet={event ? eventBadgeSnippet(event) : ''}
    title="Add a CardPop badge to your website"
    description="Paste this code on your event or ticket page. It shows the badge below and links visitors to your event on CardPop, which also helps your listing appear in Google."
  />
);

export default EventBadgeDialog;
