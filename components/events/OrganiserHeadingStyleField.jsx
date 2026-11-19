import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Type, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import apiServerClient from '@/lib/apiServerClient.js';
import OrganiserHeading from '@/components/events/OrganiserHeading.jsx';
import { logoForReading } from '@/utils/logoForReading.js';
import { isVideoLogoFile, isVideoLogoUrl, safeLogoUrl } from '@/utils/eventOrganiserLogo.js';
import { HEADING_FONTS, HEADING_FONT_KEYS, cleanHeadingStyle } from '@/utils/organiserHeadingStyle.js';

// "Match heading to logo" in the organiser page editor (admins only). Picking
// a new logo reads its lettering straight away; the preview below shows the
// page heading set to match, and nothing is saved until Save changes.
// docs/organiser-heading-style.md
export default function OrganiserHeadingStyleField({ org, logoFile, value, onChange, disabled }) {
  const [reading, setReading] = useState(false);
  const [note, setNote] = useState('');
  const run = useRef(0);

  const savedLogo = safeLogoUrl(org.logo_url);
  const source = logoFile && !isVideoLogoFile(logoFile) ? logoFile
    : (!logoFile && savedLogo && !isVideoLogoUrl(savedLogo) ? savedLogo : null);

  const match = async (from) => {
    const mine = ++run.current;
    setReading(true);
    setNote('');
    try {
      // A distinct URL so the service worker's cached (no-CORS) copy isn't reused.
      const image = await logoForReading(typeof from === 'string' ? `${from}${from.includes('?') ? '&' : '?'}for=heading` : from);
      const res = await apiServerClient.fetch('/organiser-heading/from-logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: org.name, image }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Couldn’t read the logo (${res.status})`);
      if (mine !== run.current) return;
      const style = cleanHeadingStyle(body.style, org.name);
      if (style) onChange(style);
      else setNote(body.note || 'No lettering style could be read from this logo.');
    } catch (err) {
      if (mine === run.current) toast.error(err.message || 'Couldn’t read the logo.');
    } finally {
      if (mine === run.current) setReading(false);
    }
  };

  // A newly picked logo is read as soon as it is chosen.
  useEffect(() => {
    if (logoFile && !isVideoLogoFile(logoFile)) match(logoFile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logoFile]);

  const setFont = (index, font) => onChange({
    ...value,
    segments: value.segments.map((s, i) => (i === index ? { ...s, font } : s)),
  });

  return (
    <div className="space-y-2 rounded-xl border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-xs font-bold uppercase tracking-wide">Heading style (from the logo)</Label>
        <div className="flex items-center gap-1.5">
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => { onChange(null); setNote(''); }} disabled={disabled || reading}>
              <Undo2 className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" /> Plain heading
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => match(source)} disabled={disabled || reading || !source}>
            {reading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" aria-hidden="true" /> : <Type className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />}
            {reading ? 'Reading the logo…' : value ? 'Read the logo again' : 'Match heading to logo'}
          </Button>
        </div>
      </div>

      <div className="rounded-lg bg-card border border-border px-4 py-5" aria-live="polite">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Heading preview</p>
        <OrganiserHeading as="p" name={org.name} headingStyle={value} className="text-3xl md:text-4xl text-foreground leading-tight break-words" />
      </div>

      {value?.source_fonts?.length > 0 && (
        <p className="text-sm">
          <span className="font-semibold">Font in the logo:</span> {value.source_fonts.join(' · ')}
        </p>
      )}
      {value && (
        <ul className="space-y-1.5">
          {value.segments.map((segment, i) => (
            <li key={`${i}-${segment.text}`} className="flex items-center gap-2 text-sm">
              <span className="truncate flex-1">“{segment.text}”</span>
              <select
                aria-label={`Font for ${segment.text}`}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                value={segment.font || ''}
                onChange={(e) => setFont(i, e.target.value || null)}
                disabled={disabled || reading}
              >
                <option value="">Site heading font</option>
                {HEADING_FONT_KEYS.map((key) => <option key={key} value={key}>{HEADING_FONTS[key].family}</option>)}
              </select>
            </li>
          ))}
        </ul>
      )}
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
      <p className="text-xs text-muted-foreground">
        {source
          ? 'Reads the lettering in the logo and sets the page heading in the closest matching font. Only admins see this; it goes live when you save.'
          : 'Add an image logo first — a video logo can’t be read.'}
      </p>
    </div>
  );
}
