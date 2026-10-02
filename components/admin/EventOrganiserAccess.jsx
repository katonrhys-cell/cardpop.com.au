import React, { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { BadgeCheck, Loader2 } from 'lucide-react';
import apiServerClient from '@/lib/apiServerClient';

// "Organiser access" box in the admin Who's going dialog. Links the real
// organiser's CardPop account to the event (admin-created events carry the
// admin as organiser_id) and verifies them, which lets them see this event's
// vendor list from Account → My Events. Verification applies to the account,
// so it covers every event they organise.

const callApi = async (path, init) => {
  const res = await apiServerClient.fetch(path, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Request failed');
  return body;
};

const EventOrganiserAccess = ({ eventId, organiser, onChange }) => {
  const [identifier, setIdentifier] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const linkOrganiser = async (e) => {
    e.preventDefault();
    if (!identifier.trim()) return;
    setIsLinking(true);
    try {
      const body = await callApi(`/admin/events/${eventId}/organiser`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      onChange(body.organiser);
      setIdentifier('');
      toast.success('Organiser linked to this event.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsLinking(false);
    }
  };

  const toggleVerified = async (verified) => {
    if (!organiser?.id) return;
    setIsToggling(true);
    try {
      await callApi(`/admin/event-organisers/${organiser.id}`, { method: verified ? 'PUT' : 'DELETE' });
      onChange({ ...organiser, verified });
      toast.success(verified ? 'Organiser verified — they can now see their vendor lists.' : 'Organiser verification removed.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsToggling(false);
    }
  };

  const name = organiser ? (organiser.display_name || organiser.username || 'Unnamed account') : null;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Organiser account</p>
          <p className="text-sm font-semibold text-foreground truncate">
            {name ? (
              <>
                {name}
                {organiser.username && <span className="text-muted-foreground font-normal"> @{organiser.username}</span>}
                {organiser.is_admin && <span className="text-muted-foreground font-normal"> (CardPop admin)</span>}
              </>
            ) : 'None linked'}
          </p>
        </div>
        {organiser && !organiser.is_admin && (
          <div className="flex items-center gap-2">
            <Switch
              id={`verify-organiser-${eventId}`}
              checked={!!organiser.verified}
              onCheckedChange={toggleVerified}
              disabled={isToggling}
            />
            <Label htmlFor={`verify-organiser-${eventId}`} className="text-sm flex items-center gap-1 cursor-pointer">
              {organiser.verified && <BadgeCheck className="w-4 h-4 text-primary" />}
              Verified organiser
            </Label>
          </div>
        )}
      </div>
      {organiser && !organiser.is_admin && (
        <p className="text-xs text-muted-foreground">
          {organiser.verified
            ? 'Can see the vendor list (names and profiles, no emails) for every event they organise, under Account → My Events.'
            : 'Turn on to let them see this event’s vendor list (applies to all their events).'}
        </p>
      )}
      <form onSubmit={linkOrganiser} className="flex gap-2">
        <Input
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder={organiser && !organiser.is_admin ? 'Change organiser: username or email' : 'Link organiser: username or email'}
          className="h-9"
          disabled={isLinking}
        />
        <Button type="submit" size="sm" variant="outline" disabled={isLinking || !identifier.trim()} className="h-9 shrink-0">
          {isLinking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Link'}
        </Button>
      </form>
    </div>
  );
};

export default EventOrganiserAccess;
