import { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
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
  setId,
  onCategoryChange,
  onFranchiseChange,
  onManufacturerChange,
  onSetChange,
  highlighted = false,
}) => {
  const {
    getCategories,
    getRootCategories,
    getFranchisesByCategory,
    getManufacturersByFranchise,
    getSetsByFranchiseAndManufacturer,
  } = useCategories();

  const [rootCategories, setRootCategories] = useState([]);
  const [franchises, setFranchises]         = useState([]);
  const [manufacturers, setManufacturers]   = useState([]);
  const [sets, setSets]                     = useState([]);
  const [loadingRoots, setLoadingRoots]     = useState(true);
  const [loadingSets, setLoadingSets]       = useState(false);

  // Load root categories once on mount
  useEffect(() => {
    getRootCategories().then(cats => {
      setRootCategories(cats);
      setLoadingRoots(false);
    });
  }, [getRootCategories]);

  // Load franchises whenever categoryId changes
  useEffect(() => {
    if (!categoryId) { setFranchises([]); return; }
    getFranchisesByCategory(categoryId).then(setFranchises);
  }, [categoryId, getFranchisesByCategory]);

  // Load manufacturers (+ resolve categoryId for edit mode) when franchiseId changes
  useEffect(() => {
    if (!franchiseId) { setManufacturers([]); setSets([]); return; }
    getManufacturersByFranchise(franchiseId).then(setManufacturers);

    if (!categoryId) {
      getCategories().then(all => {
        const franchise = all.find(c => c.id === franchiseId);
        if (franchise?.parent_id) {
          onCategoryChange?.(franchise.parent_id);
          getFranchisesByCategory(franchise.parent_id).then(setFranchises);
        }
      });
    }
  }, [franchiseId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load sets whenever franchise or manufacturer changes
  useEffect(() => {
    if (!franchiseId) { setSets([]); return; }
    setLoadingSets(true);
    getSetsByFranchiseAndManufacturer(franchiseId, manufacturerId)
      .then(setSets)
      .finally(() => setLoadingSets(false));
  }, [franchiseId, manufacturerId, getSetsByFranchiseAndManufacturer]);

  const handleCategoryChange = useCallback((catId) => {
    onCategoryChange?.(catId);
    onFranchiseChange?.('', '');
    onManufacturerChange?.('');
    onSetChange?.('', '');
  }, [onCategoryChange, onFranchiseChange, onManufacturerChange, onSetChange]);

  const handleFranchiseChange = useCallback((fId) => {
    const franchise = franchises.find(f => f.id === fId);
    onFranchiseChange?.(fId, franchise?.name ?? '');
    onManufacturerChange?.('');
    onSetChange?.('', '');
  }, [franchises, onFranchiseChange, onManufacturerChange, onSetChange]);

  const handleManufacturerChange = useCallback((mId) => {
    onManufacturerChange?.(mId);
    onSetChange?.('', '');
  }, [onManufacturerChange, onSetChange]);

  const handleSetChange = useCallback((sId) => {
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
            disabled={!categoryId}
          >
            <SelectTrigger className={`h-11 bg-background ${ring}`}>
              <SelectValue placeholder={categoryId ? 'Select franchise…' : 'Pick category first'} />
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
            disabled={!franchiseId}
          >
            <SelectTrigger className="h-11 bg-background">
              <SelectValue placeholder={franchiseId ? 'Select manufacturer…' : 'Pick franchise first'} />
            </SelectTrigger>
            <SelectContent>
              {manufacturers.map(m => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 2: Set — only shown once franchise is selected and sets exist */}
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
                <SelectItem value="">— Not specified —</SelectItem>
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
