
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import SEOHead from '@/components/SEOHead.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { LISTING_CARD_VAULT_EMBED_INNER } from '@/lib/listingCardColumns.js';
import { LISTING_CARD_COLUMNS, LISTING_SELLER_EMBED } from '@/lib/listingColumns.js';
import { escapeLike } from '@/src/utils/escapeLike.js';
import { buildCardSearchOr, buildVariantOr } from '@/src/utils/cardSearchFilter.js';
import { useCategories } from '@/hooks/useCategories.js';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useRefreshOnReturn } from '@/hooks/useRefreshOnReturn.js';
import { FilterChip, CheckRow, RadioRow } from '@/components/FilterChip.jsx';
import LiveActivityTicker from '@/components/LiveActivityTicker.jsx';
import {
  CARD_LANGUAGES, GRADERS, GRADE_VALUES, CONDITIONS, FEATURES, TCG_RARITIES, PRICE_PRESETS,
} from '@/lib/cardFilters.js';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, RefreshCw, AlertCircle, Users, X, Bookmark, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectGroup, SelectItem,
  SelectLabel, SelectSeparator, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import MarketplaceListingCard from '@/components/MarketplaceListingCard.jsx';
import RookieJerseyIcon from '@/components/icons/RookieJerseyIcon.jsx';
import { toast } from 'sonner';

// Sentinel for the "Any …" option in each dropdown — Radix Select can't use ''
const ANY = '__any__';

// Headline players offered as a quick filter. `term` is matched against the
// card name (ilike), so keep it to the distinctive part of the name where
// spelling/diacritics vary across sets.
const POPULAR_PLAYERS = [
  { label: 'LeBron James',          term: 'LeBron James' },
  { label: 'Stephen Curry',         term: 'Stephen Curry' },
  { label: 'Victor Wembanyama',     term: 'Wembanyama' },
  { label: 'Michael Jordan',        term: 'Michael Jordan' },
  { label: 'Kobe Bryant',           term: 'Kobe Bryant' },
  { label: 'Giannis Antetokounmpo', term: 'Giannis' },
  { label: 'Luka Dončić',           term: 'Luka Don' },
  { label: 'Kevin Durant',          term: 'Kevin Durant' },
  { label: 'Jayson Tatum',          term: 'Jayson Tatum' },
  { label: 'Anthony Edwards',       term: 'Anthony Edwards' },
];

// Renders select items split into labelled groups
const GroupedSelectItems = ({ groups, getItemLabel }) => (
  groups.map(([label, items], gi) => (
    <SelectGroup key={label}>
      {gi > 0 && <SelectSeparator />}
      <SelectLabel>{label}</SelectLabel>
      {items.map(item => (
        <SelectItem key={item.id} value={item.id}>
          {getItemLabel ? getItemLabel(item) : item.name}
        </SelectItem>
      ))}
    </SelectGroup>
  ))
);

const MarketplacePage = () => {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // 1-based ?page= in the URL, 0-based in state (declared before useSearchParams,
  // so it reads location directly)
  const [page, setPage] = useState(() => {
    try {
      const p = parseInt(new URLSearchParams(window.location.search).get('page') || '1', 10);
      return Number.isFinite(p) && p > 1 ? p - 1 : 0;
    } catch { return 0; }
  });
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 24;

  const { settings } = usePlatformSettings();
  const { currentUser } = useAuth();

  // ALL filter state is mirrored in the URL (see the writer effect below), so a
  // filtered view survives refresh and can be shared. Seed every filter from
  // the query string on mount.
  const [searchParams, setSearchParams] = useSearchParams();
  const qp = (key, fallback = '') => searchParams.get(key) ?? fallback;

  const [sort, setSort] = useState(() => qp('sort', 'created_at_desc'));
  const [filterMode, setFilterMode] = useState(() => qp('mode', 'All'));
  // Sold cards are hidden by default — a buyer browsing wants what they can
  // buy; the ?sold=1 toggle brings them back (badged "Sold") for price research.
  const [includeSold, setIncludeSold] = useState(() => qp('sold') === '1');

  // ── Attribute facets (the pill bar) ────────────────────────────────────────
  // Multi-selects are comma-joined in the URL. Vocabulary comes from
  // lib/cardFilters.js, which the add-card form also reads, so a facet can
  // never offer a value sellers have no way to enter.
  const csv = (key) => { const v = qp(key); return v ? v.split(',').filter(Boolean) : []; };

  const [filterGraded, setFilterGraded]         = useState(() => qp('graded'));   // '' | graded | raw
  const [filterGraders, setFilterGraders]       = useState(() => csv('grader'));
  const [filterGrades, setFilterGrades]         = useState(() => csv('grade'));
  const [filterConditions, setFilterConditions] = useState(() => csv('cond'));
  const [filterLanguages, setFilterLanguages]   = useState(() => csv('lang'));
  const [filterRarities, setFilterRarities]     = useState(() => csv('rarity'));
  // Rookie used to be its own `rookie=1` param and sidebar checkbox; it's now
  // one of the FEATURES entries. Legacy param still read so older saved
  // searches and shared links keep working.
  const [filterFeatures, setFilterFeatures]     = useState(() => {
    const feats = csv('feat');
    if (qp('rookie') === '1' && !feats.includes('rookie')) feats.push('rookie');
    return feats;
  });

  // 6-level hierarchy filters
  const {
    getRootCategories,
    getFranchisesByCategory,
    getManufacturersByFranchise,
    getTeamsByFranchise,
    getSetsByFranchiseAndManufacturer,
    getParallelsByFranchise,
    getSubsetsBySet,
    getAllFranchises,
    getAllManufacturers,
    getAllTeams,
    getAllSets,
    getAllParallels,
    getAllSubsets,
    buildNameMap,
  } = useCategories();

  const [filterCat, setFilterCat]             = useState(() => qp('cat'));
  const [filterFranchise, setFilterFranchise] = useState(() => qp('franchise'));
  const [filterMfr, setFilterMfr]             = useState(() => qp('mfr'));
  const [filterTeam, setFilterTeam]           = useState(() => qp('team'));
  const [filterSet, setFilterSet]             = useState(() => qp('set'));
  const [filterParallel, setFilterParallel]   = useState(() => qp('parallel'));
  const [filterSubset, setFilterSubset]       = useState(() => qp('subset'));
  const [filterPlayer, setFilterPlayer]       = useState(() => qp('player'));

  const [catOpts, setCatOpts]             = useState([]);
  const [franchiseOpts, setFranchiseOpts] = useState([]);
  const [mfrOpts, setMfrOpts]             = useState([]);
  const [teamOpts, setTeamOpts]           = useState([]);
  const [setOpts, setSetOpts]             = useState([]);
  const [parallelOpts, setParallelOpts]   = useState([]);
  const [subsetOpts, setSubsetOpts]       = useState([]);

  const [catNames, setCatNames] = useState({});
  // id → name for every category (roots + franchises) — used to label the
  // groups when a dropdown shows its full unscoped list
  const [allNames, setAllNames] = useState({});

  // Search and price. The global header search navigates to /marketplace?q=…,
  // so seed the search state from the URL param (both states, so the initial
  // fetch already carries the query instead of firing once unfiltered).
  const urlQuery = searchParams.get('q') || '';
  const [search, setSearch]     = useState(urlQuery);
  const [minPrice, setMinPrice] = useState(() => qp('min'));
  const [maxPrice, setMaxPrice] = useState(() => qp('max'));
  const [debouncedSearch, setDebouncedSearch] = useState(urlQuery);
  const [debouncedMin, setDebouncedMin]       = useState(() => qp('min'));
  const [debouncedMax, setDebouncedMax]       = useState(() => qp('max'));

  const fetchRef = useRef(null);
  // Query string this component itself last wrote — distinguishes our own URL
  // mirroring from an external navigation (header search) so the read effect
  // below never clobbers in-flight typing with a stale ?q=.
  const lastWrittenParamsRef = useRef(null);

  // Apply ?q= changes made while already on this page (a new header search
  // just updates the param — no remount).
  useEffect(() => {
    if (searchParams.toString() === lastWrittenParamsRef.current) return;
    const q = searchParams.get('q');
    if (q !== null) setSearch(q);
  }, [searchParams]);

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedMin(minPrice); setDebouncedMax(maxPrice); }, 400);
    return () => clearTimeout(t);
  }, [minPrice, maxPrice]);

  // Load root categories + full category name map once
  useEffect(() => {
    getRootCategories().then(cats => {
      setCatOpts(cats);
      const map = {};
      cats.forEach(c => { map[c.id] = c.name; });
      setCatNames(map);
    });
    buildNameMap().then(setAllNames);
  }, [getRootCategories, buildNameMap]);

  // The cascade effects below reset child filters when their parent CHANGES —
  // but each also fires once on mount, where resetting would clobber the
  // child filters just seeded from the URL. Each skips its first run.
  // applyingSavedRef suppresses the resets for the single commit in which a
  // saved search re-seeds parent AND children together.
  const catCascadeInit = useRef(true);
  const franchiseCascadeInit = useRef(true);
  const setCascadeInit = useRef(true);
  const subsetCascadeInit = useRef(true);
  const applyingSavedRef = useRef(false);

  // Franchise options: scoped to the selected category, otherwise all franchises.
  // Every level stays selectable even when its parent hasn't been chosen.
  useEffect(() => {
    if (catCascadeInit.current) catCascadeInit.current = false;
    else if (!applyingSavedRef.current) setFilterFranchise('');
    (filterCat ? getFranchisesByCategory(filterCat) : getAllFranchises()).then(setFranchiseOpts);
  }, [filterCat, getFranchisesByCategory, getAllFranchises]);

  // Manufacturer / team / parallel options: scoped to franchise, otherwise all
  useEffect(() => {
    if (franchiseCascadeInit.current) franchiseCascadeInit.current = false;
    else if (!applyingSavedRef.current) { setFilterMfr(''); setFilterTeam(''); setFilterParallel(''); }
    if (filterFranchise) {
      getManufacturersByFranchise(filterFranchise).then(setMfrOpts);
      getTeamsByFranchise(filterFranchise).then(setTeamOpts);
      getParallelsByFranchise(filterFranchise).then(setParallelOpts);
    } else {
      getAllManufacturers().then(setMfrOpts);
      getAllTeams().then(setTeamOpts);
      getAllParallels().then(setParallelOpts);
    }
  }, [filterFranchise, getManufacturersByFranchise, getTeamsByFranchise, getParallelsByFranchise, getAllManufacturers, getAllTeams, getAllParallels]);

  // Set options: scoped to franchise (and refined by manufacturer), otherwise all
  useEffect(() => {
    if (setCascadeInit.current) setCascadeInit.current = false;
    else if (!applyingSavedRef.current) setFilterSet('');
    (filterFranchise
      ? getSetsByFranchiseAndManufacturer(filterFranchise, filterMfr || '')
      : getAllSets(filterMfr || '')
    ).then(setSetOpts);
  }, [filterMfr, filterFranchise, getSetsByFranchiseAndManufacturer, getAllSets]);

  // Subset options: scoped to the selected set, otherwise all
  useEffect(() => {
    if (subsetCascadeInit.current) subsetCascadeInit.current = false;
    else if (!applyingSavedRef.current) setFilterSubset('');
    (filterSet ? getSubsetsBySet(filterSet) : getAllSubsets()).then(setSubsetOpts);
  }, [filterSet, getSubsetsBySet, getAllSubsets]);

  // Group sets by series when scoped to a franchise; by franchise when unscoped.
  // Memoized: these run over the FULL unscoped option lists, and this
  // component re-renders on every search keystroke — without memoization the
  // grouping/sorting re-ran per keypress.
  const seriesGroups = useMemo(() => {
    const groupedSets = setOpts.reduce((acc, s) => {
      const g = (filterFranchise ? s.series : allNames[s.category_id]) || 'Other';
      if (!acc[g]) acc[g] = [];
      acc[g].push(s);
      return acc;
    }, {});
    return Object.entries(groupedSets).sort(([a], [b]) => a.localeCompare(b));
  }, [setOpts, filterFranchise, allNames]);

  // Group an unscoped option list by its franchise name for readability
  const groupByFranchise = useCallback((opts) => {
    const acc = {};
    opts.forEach(o => {
      const g = allNames[o.franchise_id] || 'Other';
      if (!acc[g]) acc[g] = [];
      acc[g].push(o);
    });
    return Object.entries(acc).sort(([a], [b]) => a.localeCompare(b));
  }, [allNames]);
  const mfrGroups      = useMemo(() => groupByFranchise(mfrOpts),      [groupByFranchise, mfrOpts]);
  const teamGroups     = useMemo(() => groupByFranchise(teamOpts),     [groupByFranchise, teamOpts]);
  const parallelGroups = useMemo(() => groupByFranchise(parallelOpts), [groupByFranchise, parallelOpts]);

  // Map the "Any …" sentinel back to an empty filter value
  const clearable = (setter) => (v) => setter(v === ANY ? '' : v);

  // Sports-only facets (team, player, rookie) only make sense in a sports
  // context — a Pokémon collector should never be offered "Team" or an
  // NBA-players quick filter. Sports context = the selected root category is
  // Sports, or the selected franchise belongs to it. Deliberately anchored
  // (^sports) so "Non-Sport Cards" doesn't match.
  const SPORTS_NAME_RE = /^sports?\b/i;
  const selectedFranchise = franchiseOpts.find((f) => f.id === filterFranchise);
  const sportsContext =
    SPORTS_NAME_RE.test(catNames[filterCat] || '') ||
    (selectedFranchise
      ? SPORTS_NAME_RE.test(allNames[selectedFranchise.parent_id] || catNames[selectedFranchise.parent_id] || '')
      : false);

  // Switching context clears the facets that only exist on the other side, so
  // an invisible filter can't silently empty the results. Only runs once the
  // name/option data needed to JUDGE the context has loaded — otherwise a
  // URL-seeded view would be wiped during the initial fetch.
  useEffect(() => {
    if (!filterCat && !filterFranchise) return; // unscoped browse: nothing to judge
    if (filterCat && !catNames[filterCat]) return;            // names not loaded yet
    if (filterFranchise && !selectedFranchise) return;        // options not loaded yet
    const drop = sportsContext ? 'tcg' : 'sports';
    const dropKeys = FEATURES.filter((f) => f.context === drop).map((f) => f.key);
    setFilterFeatures((prev) => (prev.some((k) => dropKeys.includes(k))
      ? prev.filter((k) => !dropKeys.includes(k))
      : prev));
    if (!sportsContext) { setFilterTeam(''); setFilterPlayer(''); }
    else if (filterRarities.length) setFilterRarities([]); // rarity is a TCG facet

  }, [sportsContext, filterCat, filterFranchise, catNames, selectedFranchise, filterRarities.length]);

  // Sports facets stay hidden on the unscoped default view — it serves the
  // widest audience — and appear once a sports category/franchise is chosen.
  const showSportsFacets = sportsContext;

  // ── Saved searches ──────────────────────────────────────────────────────────
  // A saved search is the marketplace's own URL query string plus a label —
  // saving captures the current view, applying re-seeds the filter state.
  const [savedSearches, setSavedSearches] = useState([]);
  const [savingSearch, setSavingSearch] = useState(false);

  useEffect(() => {
    if (!currentUser?.id) { setSavedSearches([]); return; }
    let cancelled = false;
    supabase
      .from('saved_searches')
      .select('id, name, params')
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => { if (!cancelled) setSavedSearches(data || []); });
    return () => { cancelled = true; };
  }, [currentUser?.id]);

  const saveCurrentSearch = async () => {
    const params = window.location.search.replace(/^\?/, '');
    if (!params) return;
    const label = [
      debouncedSearch && `"${debouncedSearch}"`,
      ...activeChips.map((c) => c.label),
      (debouncedMin || debouncedMax) && `$${debouncedMin || '0'}–${debouncedMax || '∞'}`,
    ].filter(Boolean).join(' · ') || 'Marketplace search';
    setSavingSearch(true);
    try {
      const { data, error: insertError } = await supabase
        .from('saved_searches')
        .insert({ user_id: currentUser.id, name: label.slice(0, 120), params })
        .select('id, name, params')
        .single();
      if (insertError) {
        if (insertError.code === '23505') toast('You’ve already saved this search.');
        else throw insertError;
      } else {
        setSavedSearches((prev) => [data, ...prev].slice(0, 10));
        toast.success('Search saved — find it in the sidebar any time.');
      }
    } catch {
      toast.error('Could not save this search.');
    } finally {
      setSavingSearch(false);
    }
  };

  const deleteSavedSearch = async (id) => {
    setSavedSearches((prev) => prev.filter((s) => s.id !== id));
    await supabase.from('saved_searches').delete().eq('id', id);
  };

  // Re-seed every filter from a saved query string (the component doesn't
  // remount on an in-place URL change, so states are set directly). All setters
  // batch into one commit; applyingSavedRef makes the cascade effects skip
  // their child-resets for that commit so the applied children survive.
  const applySavedSearch = (paramsString) => {
    const p = new URLSearchParams(paramsString);
    const get = (k, d = '') => p.get(k) ?? d;
    applyingSavedRef.current = true;
    setSearch(get('q')); setDebouncedSearch(get('q'));
    setFilterMode(get('mode', 'All'));
    setSort(get('sort', 'created_at_desc'));
    setFilterCat(get('cat'));
    setFilterFranchise(get('franchise'));
    setFilterMfr(get('mfr')); setFilterTeam(get('team')); setFilterSet(get('set'));
    setFilterParallel(get('parallel')); setFilterSubset(get('subset'));
    setFilterPlayer(get('player'));
    const list = (k) => (get(k) ? get(k).split(',').filter(Boolean) : []);
    setFilterGraded(get('graded'));
    setFilterGraders(list('grader'));
    setFilterGrades(list('grade'));
    setFilterConditions(list('cond'));
    setFilterLanguages(list('lang'));
    setFilterRarities(list('rarity'));
    setFilterFeatures(() => {
      const feats = list('feat');
      if (get('rookie') === '1' && !feats.includes('rookie')) feats.push('rookie');
      return feats;
    });
    setMinPrice(get('min')); setDebouncedMin(get('min'));
    setMaxPrice(get('max')); setDebouncedMax(get('max'));
    setPage(0);
    setTimeout(() => { applyingSavedRef.current = false; }, 0);
  };

  // Main listings fetch
  useEffect(() => {
    let cancelled = false;

    const run = async (showToast = false) => {
      setLoading(true);
      setError(null);
      try {
        let query = supabase
          .from('listings')
          .select(`${LISTING_CARD_COLUMNS}, ${LISTING_CARD_VAULT_EMBED_INNER}, ${LISTING_SELLER_EMBED}`, { count: 'estimated' })
          // Available cards only unless the buyer opts into sold ones (badged
          // "Sold" — useful as price history). 'archived' is never shown.
          .in('status', includeSold ? ['active', 'sold'] : ['active'])
          .neq('listing_type', 'vault')
          .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

        // Apply hierarchy filters — most specific wins for the hierarchy levels,
        // but parallel and subset stack on top independently.
        // Embedded filters must reference the select alias ("vault_item"), not
        // the underlying table name ("vault_items") — PostgREST resolves
        // dot-notation filters against the resource's embedding label, so a
        // renamed embed silently fails to filter if you use the table name.
        if (filterSet)            query = query.eq('vault_item.set_id', filterSet);
        else if (filterMfr)       query = query.eq('vault_item.manufacturer_id', filterMfr);
        else if (filterFranchise) query = query.eq('vault_item.franchise_id', filterFranchise);
        else if (filterCat)       query = query.eq('vault_item.category_id', filterCat);

        if (filterTeam)     query = query.eq('vault_item.team_id', filterTeam);
        if (filterParallel) query = query.eq('vault_item.parallel_id', filterParallel);
        if (filterSubset)   query = query.eq('vault_item.subset_id', filterSubset);

        if (filterPlayer) query = query.ilike('vault_item.card_name', `%${escapeLike(filterPlayer)}%`);

        // ── Attribute facets ──
        // Graded vs raw. 'raw' matches the sentinel exactly rather than
        // "not graded" so this never needs an or() (see the note below on why
        // embedded or() calls can't be chained).
        if (filterGraded === 'graded')   query = query.neq('vault_item.grading_company', 'raw');
        else if (filterGraded === 'raw') query = query.eq('vault_item.grading_company', 'raw');

        if (filterGraders.length)    query = query.in('vault_item.grading_company', filterGraders);
        if (filterGrades.length)     query = query.in('vault_item.grade', filterGrades);
        if (filterConditions.length) query = query.in('vault_item.condition', filterConditions);
        if (filterLanguages.length)  query = query.in('vault_item.language', filterLanguages);

        // Column-backed feature flags
        for (const key of filterFeatures) {
          const f = FEATURES.find((x) => x.key === key);
          if (!f?.column) continue;
          query = f.kind === 'not_null'
            ? query.not(`vault_item.${f.column}`, 'is', null)
            : query.eq(`vault_item.${f.column}`, true);
        }

        // Every filter that needs an OR *on the embed* has to go into a single
        // .or() call: chained embedded .or() filters aren't reliably ANDed by
        // PostgREST. Collect the groups and encode the AND as one
        // `and(or(...),or(...))` tree (same trick as SearchResultsPage).
        //
        // Free-text search matches card name, set name and card number (see
        // CARD_SEARCH_COLUMNS) — set/number are prefilled by the AI identify at
        // listing time, so "Base Set" or "4/102" finds the card too. Rarity and
        // the variant-backed features match the `variant` taxonomy text, which
        // is why they need no columns of their own.
        const orGroups = [];
        if (debouncedSearch.trim()) orGroups.push(buildCardSearchOr(debouncedSearch));
        if (filterRarities.length)  orGroups.push(buildVariantOr(filterRarities));
        for (const key of filterFeatures) {
          const f = FEATURES.find((x) => x.key === key);
          if (!f) continue;
          if (f.variantAny) orGroups.push(buildVariantOr(f.variantAny));
          else if (f.variant) orGroups.push(buildVariantOr([f.variant]));
        }
        if (orGroups.length === 1) {
          query = query.or(orGroups[0], { referencedTable: 'vault_item' });
        } else if (orGroups.length > 1) {
          query = query.or(
            `and(${orGroups.map((g) => `or(${g})`).join(',')})`,
            { referencedTable: 'vault_item' },
          );
        }

        if (debouncedMin && !isNaN(debouncedMin)) query = query.gte('price_aud', Number(debouncedMin));
        if (debouncedMax && !isNaN(debouncedMax)) query = query.lte('price_aud', Number(debouncedMax));

        if (filterMode === 'Auction')   query = query.eq('listing_type', 'auction');
        else if (filterMode === 'BuyNow') query = query.eq('listing_type', 'fixed');
        else if (filterMode === 'ForTrade') query = query.eq('accepts_trade', true);
        else if (filterMode === 'MakeOffer') query = query.eq('accepts_offers', true).neq('listing_type', 'trade');

        if (sort === 'price_asc')  query = query.order('price_aud', { ascending: true });
        else if (sort === 'price_desc') query = query.order('price_aud', { ascending: false });
        else query = query.order('created_at', { ascending: false });

        const { data, count, error: fetchError } = await query;
        if (cancelled) return;
        if (fetchError) throw fetchError;

        setListings(data || []);
        setTotalCount(count || 0);
        if (showToast) toast.success('Marketplace data refreshed');
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load marketplace listings.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRef.current = run;
    run();
    return () => { cancelled = true; };
  }, [page, sort, filterMode, includeSold, filterCat, filterFranchise, filterMfr, filterTeam, filterSet, filterParallel, filterSubset, filterPlayer, debouncedSearch, debouncedMin, debouncedMax, filterGraded, filterGraders, filterGrades, filterConditions, filterLanguages, filterRarities, filterFeatures]);

  // Reset to the first page whenever the filters/sort change so the user never
  // lands on an out-of-range page (the stale-fetch is cancelled by the guard).
  // Skips the mount run so a URL-seeded ?page= isn't immediately zeroed.
  const pageResetInit = useRef(true);
  useEffect(() => {
    if (pageResetInit.current) { pageResetInit.current = false; return; }
    setPage(0);
  }, [sort, filterMode, includeSold, filterCat, filterFranchise, filterMfr, filterTeam, filterSet, filterParallel, filterSubset, filterPlayer, debouncedSearch, debouncedMin, debouncedMax, filterGraded, filterGraders, filterGrades, filterConditions, filterLanguages, filterRarities, filterFeatures]);

  // Mirror the full filter state into the URL (replace, no history spam) so
  // refresh and shared links reproduce the exact view. lastWrittenParamsRef
  // lets the ?q= reader distinguish our own writes from external navigation.
  useEffect(() => {
    const params = {};
    if (debouncedSearch) params.q = debouncedSearch;
    if (filterMode !== 'All') params.mode = filterMode;
    if (includeSold) params.sold = '1';
    if (sort !== 'created_at_desc') params.sort = sort;
    if (filterCat) params.cat = filterCat;
    if (filterFranchise) params.franchise = filterFranchise;
    if (filterMfr) params.mfr = filterMfr;
    if (filterTeam) params.team = filterTeam;
    if (filterSet) params.set = filterSet;
    if (filterParallel) params.parallel = filterParallel;
    if (filterSubset) params.subset = filterSubset;
    if (filterPlayer) params.player = filterPlayer;
    if (filterGraded) params.graded = filterGraded;
    if (filterGraders.length) params.grader = filterGraders.join(',');
    if (filterGrades.length) params.grade = filterGrades.join(',');
    if (filterConditions.length) params.cond = filterConditions.join(',');
    if (filterLanguages.length) params.lang = filterLanguages.join(',');
    if (filterRarities.length) params.rarity = filterRarities.join(',');
    if (filterFeatures.length) params.feat = filterFeatures.join(',');
    if (debouncedMin) params.min = debouncedMin;
    if (debouncedMax) params.max = debouncedMax;
    if (page > 0) params.page = String(page + 1);
    const next = new URLSearchParams(params).toString();
    if (next !== window.location.search.replace(/^\?/, '')) {
      lastWrittenParamsRef.current = next;
      setSearchParams(params, { replace: true });
    }
  }, [debouncedSearch, filterMode, includeSold, sort, filterCat, filterFranchise, filterMfr, filterTeam, filterSet, filterParallel, filterSubset, filterPlayer, filterGraded, filterGraders, filterGrades, filterConditions, filterLanguages, filterRarities, filterFeatures, debouncedMin, debouncedMax, page, setSearchParams]);

  // Refresh the grid when the visitor comes back to the tab after a while.
  // This page used to hold an UNFILTERED realtime subscription to every
  // `vault_items` UPDATE for every visitor, signed in or not: any seller
  // editing any private card re-ran the full listing query in every open
  // marketplace tab, and the open subscriptions kept Supabase's WAL poller
  // running around the clock (the largest consumer of DB time on the
  // project). Nobody needs a push here — the grid is a snapshot, and the
  // refresh button / return-to-tab cover staleness.
  useRefreshOnReturn(() => fetchRef.current?.());

  const clearFilters = () => {
    setFilterCat(''); setFilterFranchise(''); setFilterMfr(''); setFilterTeam(''); setFilterSet('');
    setFilterParallel(''); setFilterSubset(''); setFilterPlayer('');
    setFilterMode('All');
    setFilterGraded(''); setFilterGraders([]); setFilterGrades([]); setFilterConditions([]);
    setFilterLanguages([]); setFilterRarities([]); setFilterFeatures([]);
    setSearch(''); setMinPrice(''); setMaxPrice('');
  };

  // Remove one value from a multi-select facet
  const dropFrom = (setter) => (value) => setter((prev) => prev.filter((v) => v !== value));

  // Each active filter renders as a removable chip above the grid, so any one
  // can be cleared without reopening the dropdown it came from.
  const activeChips = useMemo(() => {
    const chips = [];
    const add = (label, clear) => { if (label) chips.push({ label, clear }); };
    add(catNames[filterCat] && filterCat ? catNames[filterCat] : null, () => setFilterCat(''));
    add(franchiseOpts.find(f => f.id === filterFranchise)?.name, () => setFilterFranchise(''));
    add(teamOpts.find(t => t.id === filterTeam)?.name, () => setFilterTeam(''));
    add(mfrOpts.find(m => m.id === filterMfr)?.name, () => setFilterMfr(''));
    add(setOpts.find(s => s.id === filterSet)?.name, () => setFilterSet(''));
    add(parallelOpts.find(p => p.id === filterParallel)?.name, () => setFilterParallel(''));
    add(subsetOpts.find(s => s.id === filterSubset)?.name, () => setFilterSubset(''));
    add(POPULAR_PLAYERS.find(p => p.term === filterPlayer)?.label, () => setFilterPlayer(''));
    if (filterGraded === 'graded') add('Graded', () => setFilterGraded(''));
    if (filterGraded === 'raw') add('Raw (ungraded)', () => setFilterGraded(''));
    filterGraders.forEach(g => add(GRADERS.find(x => x.value === g)?.label || g, () => dropFrom(setFilterGraders)(g)));
    filterGrades.forEach(g => add(`Grade ${g}`, () => dropFrom(setFilterGrades)(g)));
    filterConditions.forEach(c => add(CONDITIONS.find(x => x.value === c)?.label || c, () => dropFrom(setFilterConditions)(c)));
    filterLanguages.forEach(l => add(l, () => dropFrom(setFilterLanguages)(l)));
    filterRarities.forEach(r => add(r, () => dropFrom(setFilterRarities)(r)));
    filterFeatures.forEach(f => add(FEATURES.find(x => x.key === f)?.label || f, () => dropFrom(setFilterFeatures)(f)));
    return chips;

  }, [
    setOpts, mfrOpts, teamOpts, franchiseOpts, parallelOpts, subsetOpts, catNames,
    filterSet, filterMfr, filterTeam, filterFranchise, filterCat, filterParallel,
    filterSubset, filterPlayer, filterGraded, filterGraders, filterGrades,
    filterConditions, filterLanguages, filterRarities, filterFeatures,
  ]);
  const hasActiveFilters = Boolean(
    filterCat || filterFranchise || filterMfr || filterTeam || filterSet || filterParallel ||
    filterSubset || filterPlayer || filterMode !== 'All' || filterGraded ||
    filterGraders.length || filterGrades.length || filterConditions.length ||
    filterLanguages.length || filterRarities.length || filterFeatures.length ||
    search || minPrice || maxPrice
  );

  // Feature options relevant to what's being browsed — sports-only features
  // (rookie, refractor) hidden from TCG browsers and vice versa.
  const visibleFeatures = FEATURES.filter(
    (f) => !f.context || (f.context === 'sports' ? sportsContext : !sportsContext)
  );

  // Everything that doesn't fit a pill: the free-text box, price range, the
  // six-level category cascade and saved searches. Lives in the All Filters
  // sheet so the bar stays scannable.
  const allFiltersPanel = (
    <div className="space-y-4">
    {/* The sheet header already titles this panel, so only the reset lives here */}
    {hasActiveFilters && (
      <Button variant="ghost" size="sm" onClick={clearFilters} className="rounded-xl text-muted-foreground hover:text-foreground h-8 px-2 -mt-1">
        <X className="w-4 h-4 mr-1" /> Clear all filters
      </Button>
    )}

    {/* Save the current view / re-apply saved ones (signed-in only) */}
    {currentUser && hasActiveFilters && (
      <Button
        variant="outline"
        size="sm"
        onClick={saveCurrentSearch}
        disabled={savingSearch}
        className="w-full rounded-xl font-bold gap-1.5"
      >
        <Bookmark className="w-4 h-4" /> Save this search
      </Button>
    )}
    {currentUser && savedSearches.length > 0 && (
      <div>
        <span className="block text-xs font-semibold text-muted-foreground mb-1.5">Saved searches</span>
        <ul className="space-y-1">
          {savedSearches.map((s) => (
            <li key={s.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => applySavedSearch(s.params)}
                className="flex-1 min-w-0 truncate text-left text-sm font-medium text-foreground hover:text-primary px-2 py-1.5 rounded-lg hover:bg-muted transition-colors"
                title={s.name}
              >
                {s.name}
              </button>
              <button
                type="button"
                onClick={() => deleteSavedSearch(s.id)}
                aria-label={`Delete saved search ${s.name}`}
                className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    )}

    {/* No search box here — it lives inline in the filter bar, which stays
        visible while this sheet is open. */}

    {/* Price range */}
    <div>
      <label htmlFor="marketplace-min-price" className="block text-xs font-semibold text-muted-foreground mb-1.5">Price range</label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          id="marketplace-min-price"
          name="marketplace-min-price"
          aria-label="Minimum price"
          placeholder="Min $"
          value={minPrice}
          onChange={e => setMinPrice(e.target.value)}
          className="flex-1 h-10 rounded-xl bg-background border-border"
        />
        <span className="text-muted-foreground text-sm font-medium">–</span>
        <Input
          type="number"
          name="marketplace-max-price"
          aria-label="Maximum price"
          placeholder="Max $"
          value={maxPrice}
          onChange={e => setMaxPrice(e.target.value)}
          className="flex-1 h-10 rounded-xl bg-background border-border"
        />
      </div>
    </div>

    {/* Popular players — sports context only */}
    {showSportsFacets && (
      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Popular players</label>
        <Select value={filterPlayer} onValueChange={clearable(setFilterPlayer)}>
          <SelectTrigger aria-label="Filter by player" className="w-full bg-background border-border rounded-xl font-medium">
            <SelectValue placeholder="Player" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any player</SelectItem>
            {POPULAR_PLAYERS.map(p => (
              <SelectItem key={p.term} value={p.term}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )}

    {/* Category cascade — every level is always open and selectable;
        picking a parent just narrows the options below it */}
    <div className="space-y-3 pt-1">
      <label htmlFor="marketplace-category" className="block text-xs font-semibold text-muted-foreground">Browse by category</label>
      {/* Category */}
      <Select value={filterCat} onValueChange={clearable(setFilterCat)}>
        <SelectTrigger id="marketplace-category" aria-label="Filter by category" className="w-full bg-background border-border rounded-xl font-medium">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any category</SelectItem>
          {catOpts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
        </SelectContent>
      </Select>

      {/* Franchise */}
      <Select value={filterFranchise} onValueChange={clearable(setFilterFranchise)}>
        <SelectTrigger aria-label="Filter by franchise" className="w-full bg-background border-border rounded-xl font-medium">
          <SelectValue placeholder="Franchise" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any franchise</SelectItem>
          {filterCat
            ? franchiseOpts.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)
            : <GroupedSelectItems groups={(() => {
                const acc = {};
                franchiseOpts.forEach(f => {
                  const g = catNames[f.parent_id] || 'Other';
                  if (!acc[g]) acc[g] = [];
                  acc[g].push(f);
                });
                return Object.entries(acc).sort(([a], [b]) => a.localeCompare(b));
              })()} />}
        </SelectContent>
      </Select>

      {/* Manufacturer */}
      <Select value={filterMfr} onValueChange={clearable(setFilterMfr)}>
        <SelectTrigger aria-label="Filter by manufacturer" className="w-full bg-background border-border rounded-xl font-medium">
          <SelectValue placeholder="Manufacturer" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any manufacturer</SelectItem>
          {filterFranchise
            ? mfrOpts.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)
            : <GroupedSelectItems groups={mfrGroups} />}
        </SelectContent>
      </Select>

      {/* Team — sports context only */}
      {showSportsFacets && (
        <Select value={filterTeam} onValueChange={clearable(setFilterTeam)}>
          <SelectTrigger aria-label="Filter by team" className="w-full bg-background border-border rounded-xl font-medium">
            <SelectValue placeholder="Team" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any team</SelectItem>
            {filterFranchise
              ? teamOpts.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)
              : <GroupedSelectItems groups={teamGroups} />}
          </SelectContent>
        </Select>
      )}

      {/* Set / Release */}
      <Select value={filterSet} onValueChange={clearable(setFilterSet)}>
        <SelectTrigger aria-label="Filter by set or release" className="w-full bg-background border-border rounded-xl font-medium">
          <SelectValue placeholder="Set / Release" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any set</SelectItem>
          {seriesGroups.map(([series, items], gi) => (
            <SelectGroup key={series}>
              {gi > 0 && <SelectSeparator />}
              <SelectLabel>{series}</SelectLabel>
              {items.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>

      {/* Parallel / Variation */}
      <Select value={filterParallel} onValueChange={clearable(setFilterParallel)}>
        <SelectTrigger aria-label="Filter by parallel or variation" className="w-full bg-background border-border rounded-xl font-medium">
          <SelectValue placeholder="Parallel / Variation" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any parallel</SelectItem>
          {filterFranchise
            ? parallelOpts.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}{p.print_run ? ` /${p.print_run}` : ''}
                </SelectItem>
              ))
            : <GroupedSelectItems
                groups={parallelGroups}
                getItemLabel={p => `${p.name}${p.print_run ? ` /${p.print_run}` : ''}`}
              />}
        </SelectContent>
      </Select>

      {/* Subset / Insert */}
      <Select value={filterSubset} onValueChange={clearable(setFilterSubset)}>
        <SelectTrigger aria-label="Filter by subset or insert" className="w-full bg-background border-border rounded-xl font-medium">
          <SelectValue placeholder="Subset / Insert" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any subset</SelectItem>
          {filterSet
            ? subsetOpts.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)
            : <GroupedSelectItems groups={(() => {
                const acc = {};
                subsetOpts.forEach(s => {
                  const g = s.set?.name || 'Other';
                  if (!acc[g]) acc[g] = [];
                  acc[g].push(s);
                });
                return Object.entries(acc).sort(([a], [b]) => a.localeCompare(b));
              })()} />}
        </SelectContent>
      </Select>
    </div>

    {/* Card attributes — same set the Features pill offers, repeated here so
        the sheet is a complete view of every filter. */}
    <div className="pt-1">
      <span className="block text-xs font-semibold text-muted-foreground mb-2">Card attributes</span>
      <div className="space-y-0.5">
        {visibleFeatures.map((f) => (
          <label
            key={f.key}
            htmlFor={`marketplace-feat-${f.key}`}
            className="flex items-center gap-2.5 cursor-pointer rounded-xl px-3 py-2 font-medium text-sm hover:bg-muted/50 transition-colors"
          >
            <Checkbox
              id={`marketplace-feat-${f.key}`}
              checked={filterFeatures.includes(f.key)}
              onCheckedChange={(v) => setFilterFeatures((prev) =>
                v === true ? [...prev, f.key] : prev.filter((k) => k !== f.key))}
            />
            {f.key === 'rookie' && <RookieJerseyIcon className="w-4 h-4 shrink-0" />}
            {f.label}
          </label>
        ))}
      </div>
    </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans pb-20">
      <SEOHead
        title="Buy & Sell Trading Cards Online Australia | CardPop Marketplace"
        description="Browse Pokémon, Magic: The Gathering, Yu-Gi-Oh and sports cards listed by Australian collectors. Filter by game, grade, price and more. Free to list — buy and sell trading cards online in Australia."
        canonicalUrl="https://cardpop.com.au/marketplace"
      />

      <section className="bg-card border-b border-border py-12 md:py-20 text-center">
        <div className="container-default">
          <Users className="w-10 h-10 md:w-12 md:h-12 text-primary mx-auto mb-4 md:mb-6" />
          <h1 className="text-3xl md:text-5xl font-bold mb-4">The Marketplace</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Discover cards directly from other collectors' vaults alongside official CardPop listings.
          </p>
        </div>
      </section>

      <section className="max-w-[90rem] mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 mt-8 w-full flex-1">

        <LiveActivityTicker className="mb-6" />

        <div className="flex flex-col gap-8">

        <div className="min-w-0">

        {/* ── Filter bar ──────────────────────────────────────────────────────
            Horizontal pill dropdowns instead of a tall sidebar: the facets a
            card buyer reaches for stay one click away and visible, and the bar
            scrolls sideways on phones rather than pushing the grid down a
            screen. Facet vocabulary is shared with the add-card form
            (lib/cardFilters.js) so every option can actually be matched. */}
        <div className="mb-6 flex items-start gap-2">
          {/* Scrolls sideways on phones; wraps to a second row on desktop, where
              11 controls don't fit one line. Radix popovers portal to <body>,
              so the scroll container never clips them. */}
          <div className="flex-1 min-w-0 flex items-center md:flex-wrap gap-2 overflow-x-auto md:overflow-visible pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {/* Quick text search stays inline — it's the most-used control */}
            <div className="relative shrink-0 w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                name="marketplace-search-bar"
                aria-label="Search card name"
                placeholder="Search cards..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-10 rounded-full bg-background border-border"
              />
            </div>

            <FilterChip label="Graded" active={Boolean(filterGraded)}>
              <RadioRow value="" label="Any" current={filterGraded} onChange={setFilterGraded} />
              <RadioRow value="graded" label="Graded only" current={filterGraded} onChange={setFilterGraded} />
              <RadioRow value="raw" label="Raw (ungraded)" current={filterGraded} onChange={setFilterGraded} />
            </FilterChip>

            <FilterChip label="Grader" count={filterGraders.length}>
              {GRADERS.map((g) => (
                <CheckRow key={g.value} value={g.value} label={g.label} values={filterGraders} onChange={setFilterGraders} />
              ))}
            </FilterChip>

            <FilterChip label="Grade" count={filterGrades.length}>
              {GRADE_VALUES.map((g) => (
                <CheckRow key={g} value={g} label={g} values={filterGrades} onChange={setFilterGrades} />
              ))}
            </FilterChip>

            <FilterChip label="Condition" count={filterConditions.length}>
              {CONDITIONS.map((c) => (
                <CheckRow key={c.value} value={c.value} label={c.label} values={filterConditions} onChange={setFilterConditions} />
              ))}
            </FilterChip>

            <FilterChip label="Language" count={filterLanguages.length}>
              {CARD_LANGUAGES.map((l) => (
                <CheckRow key={l} value={l} label={l} values={filterLanguages} onChange={setFilterLanguages} />
              ))}
            </FilterChip>

            {/* Rarity is a TCG concept — sports parallels live under Parallel */}
            {!sportsContext && (
              <FilterChip label="Rarity" count={filterRarities.length}>
                {TCG_RARITIES.map((r) => (
                  <CheckRow key={r} value={r} label={r} values={filterRarities} onChange={setFilterRarities} />
                ))}
              </FilterChip>
            )}

            <FilterChip label="Features" count={filterFeatures.length}>
              {visibleFeatures.map((f) => (
                <CheckRow key={f.key} value={f.key} label={f.label} values={filterFeatures} onChange={setFilterFeatures} />
              ))}
            </FilterChip>

            <FilterChip label="Price" active={Boolean(minPrice || maxPrice)} contentClassName="w-72">
              {PRICE_PRESETS.map((p) => (
                <RadioRow
                  key={p.label}
                  value={`${p.min}-${p.max}`}
                  label={p.label}
                  current={`${minPrice}-${maxPrice}`}
                  onChange={() => { setMinPrice(p.min); setMaxPrice(p.max); }}
                />
              ))}
              <div className="mt-2 border-t border-border pt-3 px-1">
                <span className="block text-xs font-semibold text-muted-foreground mb-1.5">Custom range (AUD)</span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number" aria-label="Minimum price" placeholder="Min $"
                    value={minPrice} onChange={e => setMinPrice(e.target.value)}
                    className="h-9 rounded-xl bg-background border-border"
                  />
                  <span className="text-muted-foreground text-sm">–</span>
                  <Input
                    type="number" aria-label="Maximum price" placeholder="Max $"
                    value={maxPrice} onChange={e => setMaxPrice(e.target.value)}
                    className="h-9 rounded-xl bg-background border-border"
                  />
                </div>
              </div>
            </FilterChip>

            <FilterChip label="Buying Format" active={filterMode !== 'All'}>
              <RadioRow value="All" label="All listings" current={filterMode} onChange={setFilterMode} />
              <RadioRow value="BuyNow" label="Buy Now" current={filterMode} onChange={setFilterMode} />
              <RadioRow value="Auction" label="Auction" current={filterMode} onChange={setFilterMode} />
              <RadioRow value="MakeOffer" label="Accepts offers" current={filterMode} onChange={setFilterMode} />
              {settings.enable_trading !== false && (
                <RadioRow value="ForTrade" label="For trade" current={filterMode} onChange={setFilterMode} />
              )}
            </FilterChip>

            {/* Everything else: category cascade, price, saved searches */}
            <Sheet>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-sm font-bold whitespace-nowrap transition-colors hover:border-muted-foreground/50 hover:bg-muted/50"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                  All Filters
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[90vw] sm:w-[420px] overflow-y-auto">
                <SheetHeader className="mb-4 text-left">
                  <SheetTitle>All filters</SheetTitle>
                </SheetHeader>
                {allFiltersPanel}
              </SheetContent>
            </Sheet>
          </div>

          <div className="hidden md:flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant={includeSold ? 'default' : 'outline'}
              size="sm"
              aria-pressed={includeSold}
              onClick={() => setIncludeSold((v) => !v)}
              className="rounded-full h-10 font-medium"
            >
              {includeSold ? 'Showing sold' : 'Include sold'}
            </Button>
            <Button variant="ghost" size="icon" aria-label="Refresh listings" onClick={() => fetchRef.current?.(true)} disabled={loading} className="rounded-full h-10 w-10 bg-muted/50 hover:bg-muted">
              <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger aria-label="Sort listings" className="w-[170px] h-10 rounded-full bg-background border-border font-medium">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="created_at_desc">Newest Listings</SelectItem>
                <SelectItem value="price_asc">Price: Low to High</SelectItem>
                <SelectItem value="price_desc">Price: High to Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {activeChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className="text-xs font-semibold text-muted-foreground">Filtering by:</span>
            {activeChips.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={chip.clear}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary text-sm font-bold pl-3 pr-2 py-1 hover:bg-primary/20 transition-colors"
                aria-label={`Remove filter ${chip.label}`}
              >
                {chip.label}
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            ))}
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Result count + save-search, plus the sort control on phones (it sits
            in the filter bar from md up) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8 pb-5 border-b border-border">
          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold text-muted-foreground">
              {loading
                ? 'Loading listings…'
                : <><span className="tabular-nums text-foreground">{totalCount.toLocaleString('en-AU')}</span> {totalCount === 1 ? 'listing' : 'listings'}</>}
            </p>
            {currentUser && hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={saveCurrentSearch}
                disabled={savingSearch}
                className="rounded-full font-bold gap-1.5 h-8"
              >
                <Bookmark className="w-3.5 h-3.5" /> Save search
              </Button>
            )}
          </div>

          <div className="flex md:hidden items-center gap-2">
            <Button
              type="button"
              variant={includeSold ? 'default' : 'outline'}
              size="sm"
              aria-pressed={includeSold}
              onClick={() => setIncludeSold((v) => !v)}
              className="rounded-full h-9 shrink-0 font-medium text-xs"
            >
              {includeSold ? 'Showing sold' : 'Include sold'}
            </Button>
            <Button variant="ghost" size="icon" aria-label="Refresh listings" onClick={() => fetchRef.current?.(true)} disabled={loading} className="rounded-full h-9 w-9 shrink-0 bg-muted/50 hover:bg-muted">
              <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger aria-label="Sort listings" className="flex-1 h-9 rounded-full bg-background border-border font-medium">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="created_at_desc">Newest Listings</SelectItem>
                <SelectItem value="price_asc">Price: Low to High</SelectItem>
                <SelectItem value="price_desc">Price: High to Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {error ? (
          <div className="flex flex-col items-center justify-center py-20 bg-destructive/5 rounded-3xl border border-destructive/20 text-destructive">
            <AlertCircle className="w-12 h-12 mb-4" />
            <h3 className="text-xl font-bold mb-2">Connection Error</h3>
            <p className="mb-6">{error}</p>
            <Button onClick={() => fetchRef.current?.(true)} className="rounded-xl font-bold">Try Again</Button>
          </div>
        ) : loading && listings.length === 0 ? (
          // Skeletons only for the first load. A refetch (filter change, the
          // refresh button, coming back to the tab) keeps the current grid on
          // screen, dimmed, until the new rows land — swapping it for eight
          // skeletons collapsed the page and flashed every card.
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array(8).fill(0).map((_, i) => (
              <div key={i} className="flex flex-col space-y-4 bg-card border border-border rounded-2xl p-4">
                <Skeleton className="aspect-[4/5] w-full rounded-xl" />
                <Skeleton className="h-5 w-1/3 rounded-md" />
                <Skeleton className="h-6 w-3/4 rounded-md" />
                <Skeleton className="h-10 w-full rounded-xl mt-auto" />
              </div>
            ))}
          </div>
        ) : listings.length > 0 ? (
          <>
            <div
              className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 transition-opacity ${loading ? 'opacity-60' : ''}`}
              aria-busy={loading || undefined}
            >
              {listings.map((listing, i) => (
                <MarketplaceListingCard key={`${listing.source}-${listing.id}`} listing={listing} priority={i < 2} />
              ))}
            </div>
            {/* totalCount is an estimate (count: 'estimated'), so it can't drive
                exact page math without trapping users on empty pages (over-estimate)
                or hiding real pages (under-estimate). Drive next/prev off whether
                the current page came back full instead; the page total shown is the
                estimate (never below the current page) with no "~" marker. */}
            {(page > 0 || listings.length === PAGE_SIZE) && (
              <div className="flex items-center justify-center gap-4 mt-12">
                <Button
                  variant="outline"
                  className="rounded-xl font-bold"
                  disabled={page === 0}
                  onClick={() => { setPage(p => Math.max(0, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                >
                  Previous
                </Button>
                <span className="text-sm font-medium text-muted-foreground tabular-nums">
                  Page {page + 1}
                  {totalCount > 0 && ` of ${Math.max(Math.ceil(totalCount / PAGE_SIZE), page + 1)}`}
                </span>
                <Button
                  variant="outline"
                  className="rounded-xl font-bold"
                  disabled={listings.length < PAGE_SIZE}
                  onClick={() => { setPage(p => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 bg-card rounded-[2rem] border border-border shadow-sm">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
              <Search className="w-10 h-10 text-muted-foreground opacity-50" />
            </div>
            <p className="text-foreground text-2xl font-bold mb-3 tracking-tight">No items available</p>
            <p className="text-muted-foreground max-w-sm text-center mb-8">
              There are currently no items matching your filter criteria.
            </p>
            <div className="flex flex-col items-center gap-4 mb-8">
              <p className="text-sm font-medium text-muted-foreground">Try these suggestions:</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="outline" size="sm" onClick={clearFilters} className="rounded-full">
                  Clear All Filters
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSearch('Charizard')} className="rounded-full">
                  Charizard
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSearch('Pikachu')} className="rounded-full">
                  Pikachu
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSearch('Black Lotus')} className="rounded-full">
                  Black Lotus
                </Button>
              </div>
            </div>
            <Button onClick={clearFilters} variant="outline" className="rounded-xl font-bold">
              View All Listings
            </Button>
          </div>
        )}
        </div>{/* end main content */}
        </div>{/* end two-column layout */}
      </section>
    </div>
  );
};

export default MarketplacePage;
