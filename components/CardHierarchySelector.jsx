import { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectGroup, SelectItem,
  SelectLabel, SelectSeparator, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useCategories } from '@/hooks/useCategories.js';

/**
 * Cascading Category → Franchise → Manufacturer → Set selector.
 *
 * Props:
 *   categoryId        – controlled top-level category ID
 *   franchiseId       – controlled franchise ID
 *   manufacturerId    – controlled manufacturer ID
 *   setId             – controlled set ID
 *   onCategoryChange(id)
 *   onFranchiseChange(id, name)
 *   onManufacturerChange(id)
 *   onSetChange(id, name)
 *   highlighted       – apply AI-autofill ring style
 */
const CardHierarchySelector = ({
  categoryId,
  franchiseId,
  manufacturerId,
  teamId,
  setId,
  onCategoryChange,
  onFranchiseChange,
  onManufacturerChange,
  onTeamChange,
  onSetChange,
  highlighted = false,
}) => {
  const {
    getCategories,
    getRootCategories,
    getFranchisesByCategory,
    getManufacturersByFranchise,
    getTeamsByFranchise,
    getSetsByFranchiseAndManufacturer,
  } = useCategories();

  const [rootCategories, setRootCategories]       = useState([]);
  const [franchises, setFranchises]               = useState([]);
  const [manufacturers, setManufacturers]         = useState([]);
  const [teams, setTeams]                         = useState([]);
  const [sets, setSets]                           = useState([]);
  const [loadingRoots, setLoadingRoots]           = useState(true);
  const [loadingFranchises, setLoadingFranchises] = useState(false);
  const [loadingManufacturers, setLoadingManufacturers] = useState(false);
  const [loadingTeams, setLoadingTeams]           = useState(false);
  const [loadingSets, setLoadingSets]             = useState(false);

  // Load root categories once on mount
  useEffect(() => {
    getRootCategories()
      .then(cats => setRootCategories(cats))
      .catch(() => toast.error('Failed to load categories'))
      .finally(() => setLoadingRoots(false));
  }, [getRootCategories]);

  // Load franchises whenever categoryId changes
  useEffect(() => {
    if (!categoryId) { setFranchises([]); return; }
    setLoadingFranchises(true);
    getFranchisesByCategory(categoryId)
      .then(setFranchises)
      .catch(() => toast.error('Failed to load franchises'))
      .finally(() => setLoadingFranchises(false));
  }, [categoryId, getFranchisesByCategory]);

  // Load manufacturers (+ resolve categoryId for edit mode) when franchiseId changes
  useEffect(() => {
    if (!franchiseId) { setManufacturers([]); return; }
    setLoadingManufacturers(true);
    getManufacturersByFranchise(franchiseId)
      .then(setManufacturers)
      .catch(() => toast.error('Failed to load manufacturers'))
      .finally(() => setLoadingManufacturers(false));

    // Edit-mode only: resolve the parent category when franchise is pre-loaded but category isn't
    if (!categoryId) {
      getCategories()
        .then(all => {
          const franchise = all.find(c => c.id === franchiseId);
          if (franchise?.parent_id) {
            onCategoryChange?.(franchise.parent_id);
            getFranchisesByCategory(franchise.parent_id).then(setFranchises);
          }
        })
        .catch(() => {});
    }
  }, [franchiseId, categoryId, getManufacturersByFranchise, getCategories, getFranchisesByCategory, onCategoryChange]);

  // Load teams whenever franchiseId changes (sports franchises only have teams)
  useEffect(() => {
    if (!franchiseId) { setTeams([]); return; }
    setLoadingTeams(true);
    getTeamsByFranchise(franchiseId)
      .then(setTeams)
      .catch(() => toast.error('Failed to load teams'))
      .finally(() => setLoadingTeams(false));
  }, [franchiseId, getTeamsByFranchise]);

  // Load sets whenever franchise or manufacturer changes
  useEffect(() => {
    if (!franchiseId) { setSets([]); return; }
    setLoadingSets(true);
    getSetsByFranchiseAndManufacturer(franchiseId, manufacturerId)
      .then(setSets)
      .catch(() => toast.error('Failed to load sets'))
      .finally(() => setLoadingSets(false));
  }, [franchiseId, manufacturerId, getSetsByFranchiseAndManufacturer]);

  const handleCategoryChange = useCallback((catId) => {
    onCategoryChange?.(catId);
    onFranchiseChange?.('', '');
    onManufacturerChange?.('');
    onTeamChange?.('');
    onSetChange?.('', '');
  }, [onCategoryChange, onFranchiseChange, onManufacturerChange, onTeamChange, onSetChange]);

  const handleFranchiseChange = useCallback((fId) => {
    const franchise = franchises.find(f => f.id === fId);
    onFranchiseChange?.(fId, franchise?.name ?? '');
    onManufacturerChange?.('');
    onTeamChange?.('');
    onSetChange?.('', '');
  }, [franchises, onFranchiseChange, onManufacturerChange, onTeamChange, onSetChange]);

  const handleManufacturerChange = useCallback((mId) => {
    onManufacturerChange?.(mId);
    // Don't clear the set — sets reload filtered by the new manufacturer.
    // If the current set is in the filtered list it stays selected; if not,
    // the dropdown shows as unselected and the user can re-pick.
  }, [onManufacturerChange]);

  const handleTeamChange = useCallback((tId) => {
    // Radix Select forbids an empty-string item value, so the "no team"
    // option uses a sentinel — map it back to an empty selection.
    onTeamChange?.(tId === '__none__' ? '' : tId);
  }, [onTeamChange]);

  const handleSetChange = useCallback((sId) => {
    // Radix Select forbids an empty-string item value, so the "not specified"
    // option uses a sentinel — map it back to an empty selection.
    if (sId === '__none__') { onSetChange?.('', ''); return; }
    const found = sets.find(s => s.id === sId);
    onSetChange?.(sId, found?.name ?? '');
  }, [sets, onSetChange]);

  // Group sets by series for display
  const groupedSets = sets.reduce((acc, s) => {
    const group = s.series || 'Other';
    if (!acc[group]) acc[group] = [];
    acc[group].push(s);
    return acc;
  }, {});
  const seriesGroups = Object.entries(groupedSets).sort(([a], [b]) => a.localeCompare(b));
  const hasSets = sets.length > 0;

  if (loadingRoots) {
    return (
      <div className="md:col-span-2 flex items-center gap-2 py-3 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading categories…
      </div>
    );
  }

  const ring = highlighted ? 'border-primary/50 ring-1 ring-primary/20' : '';

  return (
    <div className="md:col-span-2 space-y-4">
      {/* Row 1: Category / Franchise / Manufacturer */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Category */}
        <div className="space-y-2">
          <Label className="font-bold">
            Category <span className="text-destructive">*</span>
          </Label>
          <Select value={categoryId || ''} onValueChange={handleCategoryChange}>
            <SelectTrigger className={`h-11 bg-background ${ring}`}>
              <SelectValue placeholder="Select category…" />
            </SelectTrigger>
            <SelectContent>
              {rootCategories.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Franchise */}
        <div className="space-y-2">
          <Label className="font-bold">
            Franchise <span className="text-destructive">*</span>
          </Label>
          <Select
            value={franchiseId || ''}
            onValueChange={handleFranchiseChange}
            disabled={!categoryId || loadingFranchises}
          >
            <SelectTrigger className={`h-11 bg-background ${ring}`}>
              {loadingFranchises
                ? <span className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</span>
                : <SelectValue placeholder={categoryId ? 'Select franchise…' : 'Pick category first'} />
              }
            </SelectTrigger>
            <SelectContent>
              {franchises.map(f => (
                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Manufacturer */}
        <div className="space-y-2">
          <Label className="font-bold">Manufacturer</Label>
          <Select
            value={manufacturerId || ''}
            onValueChange={handleManufacturerChange}
            disabled={!franchiseId || loadingManufacturers}
          >
            <SelectTrigger className="h-11 bg-background">
              {loadingManufacturers
                ? <span className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</span>
                : <SelectValue placeholder={franchiseId ? 'Select manufacturer…' : 'Pick franchise first'} />
              }
            </SelectTrigger>
            <SelectContent>
              {manufacturers.map(m => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 2: Team — only shown for franchises that have teams (sports) */}
      {franchiseId && (teams.length > 0 || loadingTeams) && (
        <div className="space-y-2">
          <Label className="font-bold">Team</Label>
          {loadingTeams ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground h-11">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading teams…
            </div>
          ) : (
            <Select value={teamId || ''} onValueChange={handleTeamChange}>
              <SelectTrigger className={`h-11 bg-background ${ring}`}>
                <SelectValue placeholder="Select team…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— No team / Not specified —</SelectItem>
                {teams.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* Row 3: Set — only shown once franchise is selected and sets exist */}
      {franchiseId && (hasSets || loadingSets) && (
        <div className="space-y-2">
          <Label className="font-bold">Set</Label>
          {loadingSets ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground h-11">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading sets…
            </div>
          ) : (
            <Select value={setId || ''} onValueChange={handleSetChange}>
              <SelectTrigger className="h-11 bg-background">
                <SelectValue placeholder="Select set…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Not specified —</SelectItem>
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
          )}
        </div>
      )}
    </div>
  );
};

export default CardHierarchySelector;
