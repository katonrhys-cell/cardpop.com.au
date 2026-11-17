import React from 'react';
import { Map } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { eventMapLinks } from '@/utils/eventMap.js';

/**
 * Venue map for an event page: a Google map of the address, with a
 * "Get directions" button. The whole map also links through to Google Maps.
 * Uses Google's keyless embed (`output=embed`) — `www.google.com` is already in
 * the CSP `frame-src`, and no API key or script is needed.
 */
export default function EventLocationMap({ location }) {
  const links = eventMapLinks(location);
  if (!links) return null;

  return (
    <div className="space-y-3">
      <Button variant="outline" className="w-full border-border hover:bg-muted font-bold" asChild>
        <a href={links.directionsUrl} target="_blank" rel="noopener noreferrer">
          <Map className="w-4 h-4 mr-2" /> Get directions
        </a>
      </Button>
      <div className="relative overflow-hidden rounded-xl border border-border bg-muted aspect-[4/3]">
        <iframe
          title={`Map of ${location}`}
          src={links.embedUrl}
          className="absolute inset-0 h-full w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
        {/* A click anywhere on the map opens Google Maps at the address. */}
        <a
          href={links.mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${location} in Google Maps`}
          className="absolute inset-0"
        />
      </div>
    </div>
  );
}
