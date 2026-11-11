import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, UserPlus } from 'lucide-react';
import apiServerClient from '@/lib/apiServerClient.js';
import { SPORTS_COLLECTIONS } from '@/data/collections.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/**
 * "Can't find them?" — a member asks for an athlete to be added to the Player
 * list. POST /player-requests bells + emails every admin; an admin confirms the
 * person is real and builds the page. Nothing is published automatically.
 * docs/players.md → Player requests
 */
const PlayerRequestDialog = ({ open, onOpenChange, initialName = '', initialSport = '' }) => {
  const [form, setForm] = useState({ name: '', sport: '', team: '', referenceUrl: '', note: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Re-seed from what the member had typed each time the dialog opens.
  useEffect(() => {
    if (open) {
      setForm({ name: initialName, sport: initialSport, team: '', referenceUrl: '', note: '' });
      setError('');
    }
  }, [open, initialName, initialSport]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await apiServerClient.fetch('/player-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.issues?.[0]?.message || body.error || 'Could not send your request');
      toast.success('Thanks — we’ll check them and let you know.');
      onOpenChange(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-primary" /> Ask us to add a player</DialogTitle>
            <DialogDescription>
              We’ll check they’re a real athlete, then set up their page. Your card is unaffected — keep listing and tag them once they’re live.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="pr-name">Player’s full name *</Label>
            <Input id="pr-name" value={form.name} onChange={(e) => set('name', e.target.value)} required minLength={2} maxLength={120} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pr-sport">Sport *</Label>
              <Input id="pr-sport" list="pr-sports" value={form.sport} onChange={(e) => set('sport', e.target.value)} required maxLength={60} placeholder="NBA, AFL, Soccer…" />
              <datalist id="pr-sports">{SPORTS_COLLECTIONS.map((s) => <option key={s} value={s} />)}</datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pr-team">Team <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
              <Input id="pr-team" value={form.team} onChange={(e) => set('team', e.target.value)} maxLength={120} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pr-ref">Link to confirm them <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
            <Input id="pr-ref" value={form.referenceUrl} onChange={(e) => set('referenceUrl', e.target.value)} placeholder="Wikipedia, league or club profile" maxLength={300} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pr-note">Anything else <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
            <Textarea id="pr-note" rows={3} value={form.note} onChange={(e) => set('note', e.target.value)} maxLength={1000} />
          </div>

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy}>
              {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…</> : 'Send request'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PlayerRequestDialog;
