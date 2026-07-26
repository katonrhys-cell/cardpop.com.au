import React from 'react';
import { CalendarPlus, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  eventCalendarSpan,
  googleCalendarUrl,
  outlookCalendarUrl,
  downloadEventIcs,
} from '@/lib/addToCalendar.js';

// Google's own mark — lucide has no brand icons, and the generic calendar glyph
// makes the three options indistinguishable at a glance.
const GoogleGlyph = (props) => (
  <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
    <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.8-2.1 5.1-4.4 6.7v5.6h7.1c4.2-3.8 6.6-9.5 6.6-16.3z" />
    <path fill="#34A853" d="M24 46c6 0 11-2 14.5-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.6-3.9-12.3-9.1H4.4v5.7C7.9 41.1 15.4 46 24 46z" />
    <path fill="#FBBC05" d="M11.7 28.1c-.4-1.3-.7-2.7-.7-4.1s.3-2.8.7-4.1v-5.7H4.4C2.9 17.1 2 20.4 2 24s.9 6.9 2.4 9.8l7.3-5.7z" />
    <path fill="#EA4335" d="M24 10.8c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.2 30 2 24 2 15.4 2 7.9 6.9 4.4 14.2l7.3 5.7c1.7-5.2 6.6-9.1 12.3-9.1z" />
  </svg>
);

const AppleGlyph = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M16.36 12.72c-.02-2.28 1.86-3.37 1.95-3.43-1.06-1.56-2.72-1.77-3.31-1.79-1.41-.14-2.75.83-3.47.83-.71 0-1.81-.81-2.98-.79-1.53.02-2.95.89-3.74 2.26-1.59 2.77-.41 6.87 1.14 9.12.76 1.1 1.66 2.34 2.85 2.29 1.14-.05 1.57-.74 2.95-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.39-.92-2.41-3.66zM14.1 5.98c.63-.76 1.05-1.82.94-2.88-.9.04-1.99.6-2.64 1.36-.58.67-1.09 1.75-.95 2.78 1 .08 2.02-.51 2.65-1.26z" />
  </svg>
);

/**
 * "Add to calendar" menu for an event detail page — Google Calendar and
 * Outlook open their web composers; Apple Calendar (and any desktop client)
 * gets a downloaded .ics.
 *
 * Renders nothing when the event has no usable start date.
 */
const AddToCalendarButton = ({ event, className = '' }) => {
  if (!eventCalendarSpan(event)) return null;

  const googleUrl = googleCalendarUrl(event);
  const outlookUrl = outlookCalendarUrl(event);

  const openExternal = (url) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleIcsDownload = () => {
    if (downloadEventIcs(event)) {
      toast.success('Calendar file downloaded — open it to add the event.');
    } else {
      toast.error("Couldn't create the calendar file.");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={`w-full h-12 border-border hover:bg-muted font-bold ${className}`}
        >
          <CalendarPlus className="w-5 h-5 mr-2" /> Add to My Calendar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-56">
        <DropdownMenuItem onSelect={() => openExternal(googleUrl)} className="cursor-pointer py-2.5">
          <GoogleGlyph className="w-4 h-4 mr-2.5 shrink-0" /> Google Calendar
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handleIcsDownload} className="cursor-pointer py-2.5">
          <AppleGlyph className="w-4 h-4 mr-2.5 shrink-0" /> Apple Calendar
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openExternal(outlookUrl)} className="cursor-pointer py-2.5">
          <svg viewBox="0 0 48 48" aria-hidden="true" className="w-4 h-4 mr-2.5 shrink-0">
            <path fill="#0364B8" d="M44 12.4v23.2c0 1-.8 1.8-1.8 1.8H20V10.6h22.2c1 0 1.8.8 1.8 1.8z" />
            <path fill="#0A2767" d="M44 16.5 26.5 26.9 44 37V16.5z" opacity=".4" />
            <path fill="#28A8EA" d="M20 10.6h22.2c1 0 1.8.8 1.8 1.8v4.1L26.5 26.9 20 23.1V10.6z" />
            <path fill="#1490DF" d="M4 8.9 25 5v38L4 39.1V8.9z" />
            <path fill="#fff" d="M14.5 17.7c-3.4 0-5.6 2.6-5.6 6.3s2.2 6.3 5.5 6.3c3.4 0 5.6-2.5 5.6-6.4 0-3.8-2.1-6.2-5.5-6.2zm-.1 10.1c-1.8 0-3-1.5-3-3.8s1.2-3.8 3-3.8 2.9 1.5 2.9 3.8-1.1 3.8-2.9 3.8z" />
          </svg>
          Outlook
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handleIcsDownload} className="cursor-pointer py-2.5">
          <Download className="w-4 h-4 mr-2.5 shrink-0" /> Download .ics file
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default AddToCalendarButton;
