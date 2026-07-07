import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GOOGLE_PLACES_ENABLED, loadGoogleMaps, parsePlace } from '@/lib/googlePlaces.js';

const AU_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];

const ShippingAddressForm = ({ values = {}, onChange, showEmail = false }) => {
  const update = (key, value) => onChange?.({ ...values, [key]: value });

  // Keep the latest values/onChange reachable from the Places callback without
  // re-binding the autocomplete on every keystroke.
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const addressInputRef = useRef(null);
  // Whether the Places widget is actually available in this session. Starts off
  // matching the build-time flag and flips to false if the script fails to load
  // (fail-open to free text — the server still validates the address).
  const [placesReady, setPlacesReady] = useState(false);
  const [placesUnavailable, setPlacesUnavailable] = useState(!GOOGLE_PLACES_ENABLED);

  useEffect(() => {
    if (!GOOGLE_PLACES_ENABLED) return;
    let cancelled = false;
    let listener = null;

    loadGoogleMaps()
      .then((google) => {
        if (cancelled || !addressInputRef.current) return;
        const autocomplete = new google.maps.places.Autocomplete(addressInputRef.current, {
          componentRestrictions: { country: 'au' },
          fields: ['address_components', 'formatted_address', 'place_id'],
          types: ['address'],
        });
        listener = autocomplete.addListener('place_changed', () => {
          const parsed = parsePlace(autocomplete.getPlace());
          if (!parsed) return; // ignore incomplete / out-of-AU selections
          onChangeRef.current?.({ ...valuesRef.current, ...parsed });
        });
        setPlacesReady(true);
      })
      .catch(() => {
        // Google unreachable — degrade to plain free-text entry, and tell the
        // page to drop its "verified pick" requirement. The server-side Address
        // Validation check remains the real guarantee.
        if (cancelled) return;
        setPlacesUnavailable(true);
        onChangeRef.current?.({ ...valuesRef.current, placesUnavailable: true });
      });

    return () => {
      cancelled = true;
      if (listener?.remove) listener.remove();
    };
  }, []);

  // When Places is active, editing an autocompleted field manually invalidates
  // the "verified" flag — the user must re-pick a suggestion to continue.
  const updateAndInvalidate = (key, value) =>
    onChange?.({ ...values, [key]: value, verified: false });

  const placesActive = placesReady && !placesUnavailable;
  const verified = Boolean(values.verified);

  return (
    <div className="space-y-4">
      {showEmail && (
        <div className="space-y-1">
          <Label>Email</Label>
          <Input type="email" value={values.email ?? ''} onChange={e => update('email', e.target.value)} placeholder="you@example.com" />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>First Name</Label>
          <Input value={values.firstName ?? ''} onChange={e => update('firstName', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Last Name</Label>
          <Input value={values.lastName ?? ''} onChange={e => update('lastName', e.target.value)} />
        </div>
      </div>
      <div className="space-y-1">
        <Label>{placesActive ? 'Search Address' : 'Street Address'}</Label>
        <div className="relative">
          {placesActive && (
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          )}
          <Input
            ref={addressInputRef}
            value={values.address ?? ''}
            onChange={e => updateAndInvalidate('address', e.target.value)}
            placeholder={placesActive ? 'Start typing your address…' : undefined}
            className={placesActive ? 'pl-9' : undefined}
            autoComplete={placesActive ? 'off' : 'street-address'}
          />
        </div>
        {placesActive && (
          verified ? (
            <p className="flex items-center gap-1.5 text-xs text-green-600">
              <CheckCircle2 className="h-3.5 w-3.5" /> Verified address
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Select your address from the suggestions so we can verify it.
            </p>
          )
        )}
      </div>
      {/* Optional unit / apartment line — free text, does not affect verification. */}
      {placesActive && (
        <div className="space-y-1">
          <Label>Unit / Apartment <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input value={values.address2 ?? ''} onChange={e => update('address2', e.target.value)} placeholder="Unit 4, Level 2…" />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Suburb</Label>
          <Input
            value={values.suburb ?? ''}
            onChange={e => updateAndInvalidate('suburb', e.target.value)}
            readOnly={placesActive}
            className={placesActive ? 'bg-muted/50' : undefined}
          />
        </div>
        <div className="space-y-1">
          <Label>State</Label>
          <Select value={values.state ?? ''} onValueChange={v => updateAndInvalidate('state', v)} disabled={placesActive}>
            <SelectTrigger><SelectValue placeholder="State" /></SelectTrigger>
            <SelectContent>
              {AU_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <Label>Postcode</Label>
        <Input
          value={values.postcode ?? ''}
          onChange={e => updateAndInvalidate('postcode', e.target.value)}
          maxLength={4}
          readOnly={placesActive}
          className={placesActive ? 'w-32 bg-muted/50' : 'w-32'}
        />
      </div>
    </div>
  );
};

export default ShippingAddressForm;
