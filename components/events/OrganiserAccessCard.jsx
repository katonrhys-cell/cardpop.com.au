import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { BadgeCheck, Clock, Loader2, Megaphone, Store, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { organiserPath } from '@/utils/eventOrganisers.js';
import { storePath } from '@/utils/storePage.js';
import { DIRECTORY_CITIES, fetchClaimableStores } from '@/lib/storeDirectory.js';

// Account → My Events: where a member applies to be confirmed as an event
// organiser or as the owner of a card shop in the directory, sees where each
// application stands, and — once an admin approves — gets to the page they
// manage. One form, with a dropdown for what they are applying as.
// docs/event-organiser-access.md · docs/store-pages.md → "Shop owners"

export const APPLY_AS_ORGANISER = 'organiser';
export const APPLY_AS_SHOP_OWNER = 'shop_owner';

const Shell = ({ icon: Icon, tone, title, label = 'Organiser and shop owner access', children }) => (
  <section className={`rounded-2xl border p-5 ${tone}`} aria-label={label}>
    <div className="flex items-start gap-3">
      <Icon className="w-5 h-5 mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <h2 className="font-bold text-base">{title}</h2>
        {children}
      </div>
    </div>
  </section>
);

const fieldLabel = 'text-xs font-bold uppercase tracking-wide';

const RequestForm = ({ options, defaultType, defaultName = '', defaultStoreSlug = '', ownedStoreIds, onSubmitOrganiser, onSubmitStore, onCancel }) => {
  const [type, setType] = useState(options.includes(defaultType) ? defaultType : options[0]);
  const [form, setForm] = useState({ organiserName: defaultName, storeId: '', roleTitle: '', websiteUrl: '', message: '' });
  const [stores, setStores] = useState(null); // null = loading
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const isShop = type === APPLY_AS_SHOP_OWNER;
  // Both dropdowns ignore an empty value: inside a <form>, Radix Select's hidden
  // native <select> reports '' when its options change, which would wipe a choice.

  // The shop list is only needed once "Card shop owner" is picked.
  useEffect(() => {
    if (!isShop || stores !== null) return undefined;
    let cancelled = false;
    fetchClaimableStores()
      .then((rows) => {
        if (cancelled) return;
        const open = rows.filter((s) => !s.owner_id && !ownedStoreIds.has(s.id));
        setStores(open);
        const preset = open.find((s) => s.slug === defaultStoreSlug);
        if (preset) setForm((f) => ({ ...f, storeId: preset.id }));
      })
      .catch(() => { if (!cancelled) setStores([]); });
    return () => { cancelled = true; };
  }, [isShop, stores, ownedStoreIds, defaultStoreSlug]);

  const storesByCity = useMemo(() => {
    const groups = {};
    for (const s of stores || []) (groups[s.city] ||= []).push(s);
    return Object.entries(groups).sort(([a], [b]) => (DIRECTORY_CITIES[a]?.label || a).localeCompare(DIRECTORY_CITIES[b]?.label || b));
  }, [stores]);

  const canSend = isShop ? Boolean(form.storeId) : form.organiserName.trim().length >= 2;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const shared = { websiteUrl: form.websiteUrl.trim() || null, message: form.message.trim() || null };
      if (isShop) {
        await onSubmitStore({ storeId: form.storeId, roleTitle: form.roleTitle.trim() || null, ...shared });
      } else {
        await onSubmitOrganiser({ organiserName: form.organiserName.trim(), ...shared });
      }
      toast.success('Request sent — we’ll confirm it shortly.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-4 space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="apply-as" className={fieldLabel}>I’m applying as</Label>
        <Select value={type} onValueChange={(next) => { if (next) setType(next); }} disabled={busy || options.length < 2}>
          <SelectTrigger id="apply-as"><SelectValue /></SelectTrigger>
          <SelectContent>
            {options.includes(APPLY_AS_ORGANISER) && <SelectItem value={APPLY_AS_ORGANISER}>Event organiser — I run card shows or events</SelectItem>}
            {options.includes(APPLY_AS_SHOP_OWNER) && <SelectItem value={APPLY_AS_SHOP_OWNER}>Card shop owner — I run a shop in the directory</SelectItem>}
          </SelectContent>
        </Select>
      </div>

      {isShop ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="apply-shop" className={fieldLabel}>Your shop</Label>
            <Select value={form.storeId} onValueChange={(storeId) => { if (storeId) setForm((f) => ({ ...f, storeId })); }} disabled={busy || !stores?.length}>
              <SelectTrigger id="apply-shop">
                <SelectValue placeholder={stores === null ? 'Loading shops…' : stores.length ? 'Choose your shop' : 'No shops available'} />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {storesByCity.map(([city, list]) => (
                  <SelectGroup key={city}>
                    <SelectLabel>{DIRECTORY_CITIES[city]?.label || city}</SelectLabel>
                    {list.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}{s.suburb ? ` — ${s.suburb}` : ''}</SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Not in the list? <Link to="/card-shops/add" className="text-primary font-semibold hover:underline">Add your shop to the directory</Link> first — once it’s listed you can apply to manage it.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="apply-role" className={fieldLabel}>Your role at the shop (optional)</Label>
            <Input id="apply-role" maxLength={80} value={form.roleTitle} onChange={set('roleTitle')} placeholder="e.g. Owner, Manager" disabled={busy} />
          </div>
        </>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="org-name" className={fieldLabel}>Organiser or business name</Label>
          <Input id="org-name" required minLength={2} maxLength={120} value={form.organiserName} onChange={set('organiserName')} placeholder="e.g. Oz Comic-Con" disabled={busy} />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="org-site" className={fieldLabel}>Website or social page</Label>
        <Input id="org-site" inputMode="url" value={form.websiteUrl} onChange={set('websiteUrl')} placeholder={isShop ? 'yourshop.com.au or instagram.com/…' : 'ozcomiccon.com or instagram.com/…'} disabled={busy} />
        <p className="text-xs text-muted-foreground">Helps us confirm it’s really you.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="org-msg" className={fieldLabel}>Anything else we should know? (optional)</Label>
        <Textarea id="org-msg" rows={3} maxLength={1000} value={form.message} onChange={set('message')} disabled={busy} />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy || !canSend} className="font-bold">
          {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />} Send request
        </Button>
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>}
      </div>
    </form>
  );
};

const NO_STORE_ACCESS = { loading: false, requests: [], stores: [], error: null, submit: null };

/**
 * `access` is useOrganiserAccess(), `storeAccess` is useStoreOwnerAccess().
 * `claimStoreSlug` opens the form on "Card shop owner" with that shop picked
 * (the "Is this your shop?" link on a shop page lands here with ?claim=<slug>).
 */
export default function OrganiserAccessCard({ access, storeAccess = NO_STORE_ACCESS, claimStoreSlug = '' }) {
  const { loading, request, organiser, submit, error } = access;
  const [showForm, setShowForm] = useState(Boolean(claimStoreSlug));

  const ownedStores = storeAccess.stores || [];
  const ownedStoreIds = useMemo(() => new Set(ownedStores.map((s) => s.id)), [ownedStores]);
  // Only the newest request per shop matters, and not once the shop is theirs.
  const storeRequests = useMemo(() => {
    const seen = new Set();
    return (storeAccess.requests || []).filter((r) => {
      if (seen.has(r.store_id) || ownedStoreIds.has(r.store_id)) return false;
      seen.add(r.store_id);
      return r.status !== 'approved';
    });
  }, [storeAccess.requests, ownedStoreIds]);

  if (loading || storeAccess.loading) return null;
  // The organiser half failing shouldn't hide a working shop half, and vice versa.
  const organiserOk = !error;
  const shopOk = !storeAccess.error && typeof storeAccess.submit === 'function';
  if (!organiserOk && !shopOk) return null;

  const organiserPending = request?.status === 'pending';
  const organiserRejected = request?.status === 'rejected';
  const options = [
    organiserOk && !organiser && !organiserPending ? APPLY_AS_ORGANISER : null,
    shopOk ? APPLY_AS_SHOP_OWNER : null,
  ].filter(Boolean);

  const organiserPagePath = organiser ? organiserPath(organiser) : null;
  const hasAnything = Boolean(organiser) || organiserPending || ownedStores.length > 0 || storeRequests.length > 0;

  return (
    <div className="space-y-3">
      {organiser && (
        <Shell icon={BadgeCheck} tone="border-emerald-300 bg-emerald-500/5" title={`You manage ${organiser.name}`}>
          <p className="text-sm text-muted-foreground mt-1">
            CardPop confirmed you as this organiser. Edit its logo, description and links from the page itself.
          </p>
          {organiserPagePath && (
            <Button asChild size="sm" className="mt-3 rounded-xl font-bold">
              <Link to={organiserPagePath}>Open &amp; edit your organiser page</Link>
            </Button>
          )}
        </Shell>
      )}

      {ownedStores.map((store) => (
        <Shell key={store.id} icon={BadgeCheck} tone="border-emerald-300 bg-emerald-500/5" title={`You manage ${store.name}`}>
          <p className="text-sm text-muted-foreground mt-1">
            CardPop confirmed you as this shop’s owner. Edit its details, opening hours, logo, photos and videos from the page itself.
          </p>
          {storePath(store) && (
            <Button asChild size="sm" className="mt-3 rounded-xl font-bold">
              <Link to={storePath(store)}>Open &amp; edit your shop page</Link>
            </Button>
          )}
        </Shell>
      ))}

      {organiserPending && (
        <Shell icon={Clock} tone="border-amber-300 bg-amber-500/5" title="Organiser request with the CardPop team">
          <p className="text-sm text-muted-foreground mt-1">
            You asked to manage <strong>{request.organiser_name}</strong>. We’ll check it and email you the moment it’s confirmed.
          </p>
        </Shell>
      )}

      {storeRequests.map((r) => (r.status === 'pending' ? (
        <Shell key={r.id} icon={Clock} tone="border-amber-300 bg-amber-500/5" title="Shop owner request with the CardPop team">
          <p className="text-sm text-muted-foreground mt-1">
            You asked to manage <strong>{r.store?.name || 'your shop'}</strong>. We’ll check it and email you the moment it’s confirmed.
          </p>
        </Shell>
      ) : (
        <Shell key={r.id} icon={XCircle} tone="border-destructive/30 bg-destructive/5" title={`Your request for ${r.store?.name || 'the shop'} wasn’t approved`}>
          <p className="text-sm text-muted-foreground mt-1">
            {r.decision_note ? <>Reason: {r.decision_note}. </> : null}
            You can send a new request with more detail.
          </p>
        </Shell>
      )))}

      {options.length > 0 && (
        <Shell
          icon={organiserRejected ? XCircle : options.includes(APPLY_AS_ORGANISER) ? Megaphone : Store}
          tone={organiserRejected ? 'border-destructive/30 bg-destructive/5' : 'border-primary/20 bg-primary/5'}
          title={organiserRejected
            ? 'Your organiser request wasn’t approved'
            : options.includes(APPLY_AS_ORGANISER)
              ? 'Do you run card shows, events or a card shop?'
              : hasAnything ? 'Run another card shop?' : 'Do you run a card shop?'}
        >
          {organiserRejected ? (
            <p className="text-sm text-muted-foreground mt-1">
              {request.decision_note ? <>Reason: {request.decision_note}. </> : null}
              You can send a new request with more detail.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">
              Apply to be confirmed as an event organiser or as the owner of a shop in the card shop directory, and you’ll be able to edit your own page — logo, description, links, and for a shop its opening hours, photos and videos.
            </p>
          )}
          {showForm ? (
            <RequestForm
              options={options}
              defaultType={claimStoreSlug ? APPLY_AS_SHOP_OWNER : APPLY_AS_ORGANISER}
              defaultName={request?.organiser_name || ''}
              defaultStoreSlug={claimStoreSlug}
              ownedStoreIds={ownedStoreIds}
              onSubmitOrganiser={async (payload) => { await submit(payload); setShowForm(false); }}
              onSubmitStore={async (payload) => { await storeAccess.submit(payload); setShowForm(false); }}
              onCancel={() => setShowForm(false)}
            />
          ) : (
            <Button size="sm" variant={organiserRejected ? 'outline' : 'default'} className="mt-3 rounded-xl font-bold" onClick={() => setShowForm(true)}>
              {organiserRejected ? 'Send a new request' : options.includes(APPLY_AS_ORGANISER) ? 'Apply as an organiser or shop owner' : 'Apply as a shop owner'}
            </Button>
          )}
        </Shell>
      )}
    </div>
  );
}
