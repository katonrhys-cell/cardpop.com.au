import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Loader2, MapPin, Search, XCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  ADDRESS_AUTOCOMPLETE_ENABLED,
  ADDRESS_AUTOCOMPLETE_LABEL,
  autocompleteAddress,
  resolveSuggestion,
} from '@/lib/addressAutocomplete.js';

const AU_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];
const DEBOUNCE_MS = 250;

const ShippingAddressForm = ({ values = {}, onChange, showEmail = false, emailAccountExists = false, signInReturnPath = '/checkout' }) => {
  const update = (key, value) => onChange?.({ ...values, [key]: value });

  // Keep the latest values/onChange reachable from async callbacks without
  // re-binding effects on every keystroke.
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Autocomplete state.
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  // Flips to true if a request errors — we then degrade to plain free-text and
  // drop the "verified pick" gate (the server still validates the address).
  const [unavailable, setUnavailable] = useState(!ADDRESS_AUTOCOMPLETE_ENABLED);

  const containerRef = useRef(null);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);

  const placesActive = ADDRESS_AUTOCOMPLETE_ENABLED && !unavailable;
  const verified = Boolean(values.verified);

  // Log the real failure to the console (status + the provider's message) and
  // degrade to manual entry. The visible fallback below tells the shopper why the search
  // box went away, so a misconfigured key never looks like a broken form.
  const degradeToManual = useCallback((context, err) => {
    console.warn(`[address] ${ADDRESS_AUTOCOMPLETE_LABEL} ${context} failed — falling back to manual entry.`, err);
    setUnavailable(true);
    onChangeRef.current?.({ ...valuesRef.current, placesUnavailable: true });
  }, []);

  const closeSuggestions = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  // Close the dropdown on an outside click.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        closeSuggestions();
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open, closeSuggestions]);

  // Tear down any pending timer / request on unmount.
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
  }, []);

  const runSearch = useCallback((query) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);

    autocompleteAddress(query, { signal: controller.signal })
      .then((results) => {
        if (controller.signal.aborted) return;
        setSuggestions(results);
        setActiveIndex(-1);
        setOpen(results.length > 0);
      })
      .catch((err) => {
        if (controller.signal.aborted || err?.name === 'AbortError') return;
        // Provider unreachable / key misconfigured — degrade to plain free-text entry
        // and tell the page to drop its "verified pick" requirement.
        degradeToManual('autocomplete', err);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
  }, [degradeToManual]);

  // Editing the street field (re)invalidates the verified flag and kicks off a
  // debounced search.
  const onAddressInput = (value) => {
    onChange?.({ ...values, address: value, verified: false });
    if (!placesActive) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 3) {
      closeSuggestions();
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(() => runSearch(value), DEBOUNCE_MS);
  };

  const selectSuggestion = async (suggestion) => {
    if (!suggestion) return;
    closeSuggestions();
    // Optimistically show the chosen label while we resolve structured details
    // (usually already inline in the suggestion — no extra request).
    onChangeRef.current?.({ ...valuesRef.current, address: suggestion.label, verified: false });
    setLoading(true);
    try {
      const parsed = await resolveSuggestion(suggestion);
      if (parsed) {
        onChangeRef.current?.({ ...valuesRef.current, ...parsed });
      }
    } catch (err) {
      degradeToManual('get-place', err);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0) {
        e.preventDefault();
        selectSuggestion(suggestions[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      closeSuggestions();
    }
  };

  // When Places is active, editing an autocompleted field manually invalidates
  // the "verified" flag — the user must re-pick a suggestion to continue.
  const updateAndInvalidate = (key, value) =>
    onChange?.({ ...values, [key]: value, verified: false });

  return (
    <div className="space-y-4">
      {showEmail && (
        <div className="space-y-1">
          <Label>Email</Label>
          <div className="relative">
            <Input
              type="email"
              value={values.email ?? ''}
              onChange={e => update('email', e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              aria-invalid={emailAccountExists || undefined}
              className={cn(emailAccountExists && 'border-destructive pr-9 focus-visible:ring-destructive')}
            />
            {emailAccountExists && (
              <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
            )}
          </div>
          {/* This email already belongs to a CardPop account — nudge the shopper
              to sign in (guest checkout still works, but signing in links the
              order to their account). */}
          {emailAccountExists && (
            <p className="text-xs text-muted-foreground">
              You already have an account with this email.{' '}
              <Link
                to="/login"
                state={{ from: { pathname: signInReturnPath } }}
                className="font-semibold text-primary underline underline-offset-2"
              >
                Sign in
              </Link>
            </p>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>First Name</Label>
          <Input value={values.firstName ?? ''} onChange={e => update('firstName', e.target.value)} autoComplete="given-name" />
        </div>
        <div className="space-y-1">
          <Label>Last Name</Label>
          <Input value={values.lastName ?? ''} onChange={e => update('lastName', e.target.value)} autoComplete="family-name" />
        </div>
      </div>

      <div className="space-y-1" ref={containerRef}>
        <Label>{placesActive ? 'Search Address' : 'Street Address'}</Label>
        <div className="relative">
          {placesActive && (
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          )}
          <Input
            value={values.address ?? ''}
            onChange={e => onAddressInput(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => { if (suggestions.length > 0 && !verified) setOpen(true); }}
            placeholder={placesActive ? 'Start typing your address…' : undefined}
            className={cn(placesActive && 'pl-9', placesActive && 'pr-9')}
            autoComplete={placesActive ? 'off' : 'street-address'}
            role={placesActive ? 'combobox' : undefined}
            aria-expanded={placesActive ? open : undefined}
            aria-autocomplete={placesActive ? 'list' : undefined}
          />
          {placesActive && loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
          {placesActive && !loading && verified && (
            <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-600" />
          )}

          {placesActive && open && suggestions.length > 0 && (
            <ul
              className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-lg"
              role="listbox"
            >
              {suggestions.map((s, i) => (
                <li
                  key={s.placeId}
                  role="option"
                  aria-selected={i === activeIndex}
                  // onMouseDown (not onClick) so the field's blur doesn't close
                  // the list before the selection registers.
                  onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s); }}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={cn(
                    'flex cursor-pointer items-start gap-2 px-3 py-2 text-sm',
                    i === activeIndex ? 'bg-accent text-accent-foreground' : 'text-foreground',
                  )}
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="leading-snug">{s.label}</span>
                </li>
              ))}
            </ul>
          )}
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
        {/* Autocomplete was enabled but a request failed — tell the shopper the
            search fell back to manual entry rather than leaving them puzzled. */}
        {ADDRESS_AUTOCOMPLETE_ENABLED && unavailable && (
          <p className="text-xs text-muted-foreground">
            Address search is unavailable right now — please enter your address manually.
          </p>
        )}
      </div>

      {/* Optional unit / apartment line — free text, does not affect verification. */}
      {placesActive && (
        <div className="space-y-1">
          <Label>Unit / Apartment <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input value={values.address2 ?? ''} onChange={e => update('address2', e.target.value)} placeholder="Unit 4, Level 2…" autoComplete="address-line2" />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Suburb</Label>
          <Input
            value={values.suburb ?? ''}
            onChange={e => updateAndInvalidate('suburb', e.target.value)}
            readOnly={placesActive}
            autoComplete="address-level2"
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
          autoComplete="postal-code"
          inputMode="numeric"
          pattern="[0-9]*"
          className={placesActive ? 'w-32 bg-muted/50' : 'w-32'}
        />
      </div>
      {/* There is no country field because there is no choice: the server
          refuses any non-Australian delivery address (checkAustralianAddress in
          src/utils/addressValidation.js). Saying so here means a buyer finds
          out before they fill the form in, not after they press pay. */}
      <p className="text-xs text-muted-foreground">
        We currently ship within <span className="font-semibold text-foreground">Australia</span> only.
      </p>
    </div>
  );
};

export default ShippingAddressForm;
