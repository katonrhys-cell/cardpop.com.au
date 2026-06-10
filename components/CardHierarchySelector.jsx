import { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCategories } from '@/hooks/useCategories.js';

/**
 * Cascading Category → Franchise → Manufacturer selector.
 *
 * Props:
 *   categoryId      – controlled top-level category ID
 *   franchiseId     – controlled franchise ID
 *   manufacturerId  – controlled manufacturer ID
 *   onCategoryChange(id)
 *   onFranchiseChange(id, name)
 *   onManufacturerChange(id)
 *   highlighted     – apply AI-autofill ring style
 */
const CardHierarchySelector = ({
  categoryId,
  franchiseId,
  manufacturerId,
  onCategoryChange,
  onFranchiseChange,
  onManufacturerChange,
  highlighted = false,
}) => {
  const { getCategories, getRootCategories, getFranchisesByCategory, getManufacturersByFranchise } = useCategories();

  const [rootCategories, setRootCategories] = useState([]);
  const [franchises, setFranchises]         = useState([]);
  const [manufacturers, setManufacturers]   = useState([]);
  const [loadingRoots, setLoadingRoots]     = useState(true);

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

  // Load manufacturers whenever franchiseId changes.
  // Also: if categoryId is missing (edit-mode load) resolve it from the franchise's parent.
  useEffect(() => {
    if (!franchiseId) { setManufacturers([]); return; }
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

  const handleCategoryChange = useCallback((catId) => {
    onCategoryChange?.(catId);
    onFranchiseChange?.('', '');
    onManufacturerChange?.('');
  }, [onCategoryChange, onFranchiseChange, onManufacturerChange]);

  const handleFranchiseChange = useCallback((fId) => {
    const franchise = franchises.find(f => f.id === fId);
    onFranchiseChange?.(fId, franchise?.name ?? '');
    onManufacturerChange?.('');
  }, [franchises, onFranchiseChange, onManufacturerChange]);

  if (loadingRoots) {
    return (
      <div className="md:col-span-2 flex items-center gap-2 py-3 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading categories…
      </div>
    );
  }

  const ring = highlighted ? 'border-primary/50 ring-1 ring-primary/20' : '';

  return (
    <div className="md:col-span-2 grid md:grid-cols-3 gap-4">
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
          onValueChange={id => onManufacturerChange?.(id)}
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
  );
};

export default CardHierarchySelector;
