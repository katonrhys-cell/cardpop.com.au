import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Save, Upload, Image as ImageIcon, ChevronRight, ChevronDown, Sparkles, Loader2,
  Lock, ShoppingCart, ArrowRightLeft, Layers, Award, Star, Shield, TrendingUp, Plus, X, Crop,
  Frame, Wand2, SlidersHorizontal,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { useCategories } from '@/hooks/useCategories.js';
import CardHierarchySelector from '@/components/CardHierarchySelector.jsx';
import { COLLECTION_CONFIGS } from '@/data/collectionConfigs.js';
import { useCollectionEras } from '@/hooks/useCollectionEras.js';
import { getVariantGroups } from '@/lib/cardVariants.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useCardOCR } from '@/hooks/useCardOCR.js';
import { useEbayPriceLookup } from '@/hooks/useEbayPriceLookup.js';
import { useCardSight, mapCardSightToFormFields } from '@/hooks/useCardSight.js';
import { usePhotoTemplate } from '@/hooks/usePhotoTemplate.js';
import PSAPopPanel from '@/components/PSAPopPanel.jsx';
import { useCardsightPricing } from '@/hooks/useCardsightPricing.js';
import PhotoQualityScore from '@/components/PhotoQualityScore.jsx';
import PhotoTemplateModal from '@/components/PhotoTemplateModal.jsx';
import { analyzePhotoQuality } from '@/utils/photoQuality.js';
import { compressImage } from '@/utils/compressImage.js';
import { useCardCrop } from '@/hooks/useCardCrop.js';
import CardCropPreview from '@/components/CardCropPreview.jsx';
import CardCornerAdjuster from '@/components/CardCornerAdjuster.jsx';
import { warpCardWithCorners } from '@/utils/detectCard.js';

// ─── Grading companies ────────────────────────────────────────────────────────
const GRADING_COMPANIES = [
  { value: 'raw',   label: 'Raw',   sub: 'Ungraded',      activeClass: 'border-slate-500 bg-slate-500/10 text-slate-700 dark:text-slate-300' },
  { value: 'psa',   label: 'PSA',   sub: 'PSA Grading',   activeClass: 'border-red-500 bg-red-500/10 text-red-700 dark:text-red-400' },
  { value: 'bgs',   label: 'BGS',   sub: 'Beckett',       activeClass: 'border-blue-600 bg-blue-600/10 text-blue-700 dark:text-blue-400' },
  { value: 'cgc',   label: 'CGC',   sub: 'CGC Cards',     activeClass: 'border-green-600 bg-green-600/10 text-green-700 dark:text-green-400' },
  { value: 'ace',   label: 'ACE',   sub: 'ACE Grading',   activeClass: 'border-orange-500 bg-orange-500/10 text-orange-700 dark:text-orange-400' },
  { value: 'sgc',   label: 'SGC',   sub: 'SGC',           activeClass: 'border-purple-500 bg-purple-500/10 text-purple-700 dark:text-purple-400' },
  { value: 'other', label: 'Other', sub: 'Other service', activeClass: 'border-muted-foreground/50 bg-muted text-foreground' },
];

const COMMON_GRADES = ['10', '9.5', '9', '8.5', '8', '7', '6', '5'];

// ─── Listing visibility options ───────────────────────────────────────────────
const LISTING_OPTIONS = [
  { value: 'private',         label: 'Private',     description: 'Only visible to you', Icon: Lock,            activeClass: 'border-slate-500 bg-slate-500/10 text-slate-700 dark:text-slate-300', iconClass: 'text-slate-500' },
  { value: 'For Sale',        label: 'For Sale',    description: 'List with a price',   Icon: ShoppingCart,    activeClass: 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400', iconClass: 'text-emerald-500' },
  { value: 'For Trade',       label: 'For Trade',   description: 'Open to trades',      Icon: ArrowRightLeft,  activeClass: 'border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-400', iconClass: 'text-violet-500' },
  { value: 'For Sale & Trade', label: 'Sale & Trade', description: 'Both options open', Icon: Layers,          activeClass: 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400', iconClass: 'text-amber-500' },
];

// ─── Section heading ──────────────────────────────────────────────────────────
const SectionCard = ({ title, children, className = '' }) => (
  <div className={`premium-card p-6 bg-card space-y-5 ${className}`}>
    <h2 className="font-serif text-xl font-bold border-b border-border pb-3">{title}</h2>
    {children}
  </div>
);

// Convert a preview URL (data: or blob:/object URL) into a Blob. fetch() on
// large data: URLs is unreliable on mobile Safari, so decode those manually.
const previewUrlToBlob = async (url) => {
  if (url.startsWith('data:')) {
    const [header, base64] = url.split(',');
    const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
  return (await fetch(url)).blob();
};

const AddEditCardPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { getCategories, getParallelsByFranchise, getSubsetsBySet } = useCategories();

  const isEdit = !!id;
  const [loading, setLoading]           = useState(isEdit);
  const [saving, setSaving]             = useState(false);
  const [imageFile, setImageFile]       = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [extraFiles, setExtraFiles]     = useState([null, null, null, null, null]);
  const [extraPreviews, setExtraPreviews] = useState([null, null, null, null, null]);
  const [errors, setErrors]             = useState({});
  const [isAutoFilled, setIsAutoFilled] = useState(false);
  // Hierarchy selection
  const [selCategoryId, setSelCategoryId]     = useState('');
  const [franchiseId, setFranchiseId]         = useState('');
  const [manufacturerId, setManufacturerId]   = useState('');
  const [teamId, setTeamId]                   = useState('');
  const [setId, setSetId]                     = useState('');
  const [parallelId, setParallelId]           = useState('');
  const [parallelOpts, setParallelOpts]       = useState([]);
  const [subsetId, setSubsetId]               = useState('');
  const [subsetOpts, setSubsetOpts]           = useState([]);
  const [lockedBaseValue, setLockedBaseValue] = useState(null);
  const [psaPopData, setPsaPopData]           = useState(null);
  const [photoQuality, setPhotoQuality]       = useState(null);
  const [checkingQuality, setCheckingQuality] = useState(false);
  const { detectingKey, candidate: cropCandidate, detect: detectCrop, clear: clearCrop } = useCardCrop();
  const [adjusting, setAdjusting]             = useState(null); // { key, file, imageUrl, initialCorners }
  const [showAutoGuide, setShowAutoGuide]     = useState(false);
  const [showPatchGuide, setShowPatchGuide]   = useState(false);
  const [showRelicGuide, setShowRelicGuide]   = useState(false);
  const [showNumberGuide, setShowNumberGuide] = useState(false);
  const [showSpGuide, setShowSpGuide]         = useState(false);
  const [showRookieGuide, setShowRookieGuide] = useState(false);
  const [showRefractorGuide, setShowRefractorGuide] = useState(false);
  const [showPrizmGuide, setShowPrizmGuide]   = useState(false);

  const { scanCard, isScanning, scanResult, clearScan } = useCardOCR();
  const { lookupPrice, isLookingUp, priceData, clearPrice } = useEbayPriceLookup();
  const { identify: cardSightIdentify, isIdentifying, result: cardSightResult, clearResult: clearCardSight } = useCardSight();
  const { fetchPricingById, fetchPricingByName, isLoadingCsPrice, csPrice, clearCsPrice } = useCardsightPricing();
  const { isProcessing: isPhotoProcessing, previewUrl, createSlabImagePreview, reset: resetPhotoTemplate } = usePhotoTemplate();

  // Photo template modal state
  const [photoTemplateModal, setPhotoTemplateModal] = useState({ open: false, processType: null, step: 'preview' });
  const [isUploadingTemplate, setIsUploadingTemplate] = useState(false);

  const emptyForm = {
    // Card identity
    collection:     '',
    cardName:       '',
    setName:        '',
    cardNumber:     '',
    year:           '',
    variant:        [],
    // Attributes
    isFoil:         false,
    isSealed:       false,
    isRookie:       false,
    serialNumber:   '',
    isAuto:         false,
    autoType:       '',
    autoSigners:    1,
    patchType:      '',
    patchPieces:    1,
    relicMaterial:  '',
    relicSource:    '',
    serialPosition: '',
    serialPrintRun: '',
    spVariation:    '',
    spTier:         '',
    rookieType:     '',
    rookieLogo:     '',
    refractorType:  '',
    refractorColor: '',
    prizmType:      '',
    prizmColor:     '',
    // Grading
    gradingCompany: 'raw',
    grade:          '',
    certNumber:     '',
    // Condition & value
    condition:      'near_mint',
    estimatedValue: '',
    purchasePrice:  '',
    acquiredDate:   '',
    acquiredFrom:   '',
    notes:          '',
    // Listing
    tradeValue:     '',
    listingType:    'private',
  };

  const [formData, setFormData] = useState(emptyForm);

  const set = (key, val) => setFormData(f => ({ ...f, [key]: val }));

  // Derive collection slug for era lookups (uses franchise name stored in formData.collection)
  const collectionSlug = (() => {
    const selected = formData.collection?.toLowerCase();
    const entry = Object.entries(COLLECTION_CONFIGS).find(([, cfg]) =>
      [cfg.name, ...(cfg.categoryAliases ?? [])].some(a => a.toLowerCase() === selected)
    );
    return entry?.[0] ?? null;
  })();

  // Fetch eras from DB for the selected collection (falls back to static config)
  const { eras: eraOpts } = useCollectionEras(collectionSlug);

  // When AI autofills formData.collection (a name string), try to resolve it to a franchiseId
  useEffect(() => {
    if (!formData.collection || franchiseId) return;
    getCategories().then(cats => {
      const selected = formData.collection.toLowerCase();
      const configEntry = Object.values(COLLECTION_CONFIGS).find(cfg =>
        [cfg.name, ...(cfg.categoryAliases ?? [])].some(a => a.toLowerCase() === selected)
      );
      const aliases = configEntry
        ? [configEntry.name, ...(configEntry.categoryAliases ?? [])].map(a => a.toLowerCase())
        : [selected];
      const match = cats.find(c => c.parent_id !== null && aliases.includes(c.name.toLowerCase()));
      if (match) setFranchiseId(match.id);
    });
  }, [formData.collection]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load parallels whenever franchise changes
  useEffect(() => {
    setParallelId('');
    setParallelOpts([]);
    if (franchiseId) getParallelsByFranchise(franchiseId).then(setParallelOpts);
  }, [franchiseId, getParallelsByFranchise]);

  // Load subsets whenever set changes
  useEffect(() => {
    setSubsetId('');
    setSubsetOpts([]);
    if (setId) getSubsetsBySet(setId).then(setSubsetOpts);
  }, [setId, getSubsetsBySet]);

  // ─── Load existing card when editing ─────────────────────────────────────
  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    const fetchCard = async () => {
      if (!currentUser?.id) { if (!cancelled) setLoading(false); return; }
      try {
        const { data: card, error: fetchError } = await supabase
          .from('vault_items')
          .select('*')
          .eq('id', id)
          .single();
        if (fetchError) throw fetchError;
        if (cancelled) return;
        if (!currentUser || card.owner_id !== currentUser.id) {
          toast.error('Unauthorized');
          navigate('/vault');
          return;
        }
        setLockedBaseValue(card.locked_base_value_aud ?? null);

        // Restore hierarchy selectors
        const resolvedFranchise = card.franchise_id ?? null;
        if (resolvedFranchise) setFranchiseId(resolvedFranchise);
        if (card.category_id) setSelCategoryId(card.category_id);
        if (card.manufacturer_id) setManufacturerId(card.manufacturer_id);
        if (card.team_id) setTeamId(card.team_id);
        if (card.set_id) setSetId(card.set_id);
        if (card.parallel_id) setParallelId(card.parallel_id);
        if (card.subset_id) setSubsetId(card.subset_id);

        // Fetch PSA population data if the card has a CardSight ID
        if (card.cardsight_card_id) {
          supabase
            .from('card_market_valuations')
            .select('raw_data')
            .eq('card_id', card.cardsight_card_id)
            .eq('source', 'psa')
            .maybeSingle()
            .then(({ data }) => { if (data?.raw_data) setPsaPopData(data.raw_data); });
        }

        setFormData({
          collection:     card.collection     || 'Pokemon',
          cardName:       card.card_name      || '',
          setName:        card.set_name       || '',
          cardNumber:     card.card_number    || '',
          year:           card.year           ? String(card.year) : '',
          variant:        card.variant ? card.variant.split(',').map(s => s.trim()).filter(Boolean) : [],
          isFoil:         card.is_foil        ?? false,
          isSealed:       card.is_sealed      ?? false,
          isRookie:       card.is_rookie      ?? false,
          serialNumber:   card.serial_number  || '',
          isAuto:         card.is_auto        ?? false,
          autoType:       card.auto_type      || '',
          autoSigners:    card.auto_signers   ?? 1,
          patchType:      card.patch_type     || '',
          patchPieces:    card.patch_pieces   ?? 1,
          relicMaterial:  card.relic_material || '',
          relicSource:    card.relic_source   || '',
          serialPosition: card.serial_position  != null ? String(card.serial_position)  : '',
          serialPrintRun: card.serial_print_run != null ? String(card.serial_print_run) : '',
          spVariation:    card.sp_variation    || '',
          spTier:         card.sp_tier         || '',
          rookieType:     card.rookie_type     || '',
          rookieLogo:     card.rookie_logo     || '',
          refractorType:  card.refractor_type  || '',
          refractorColor: card.refractor_color || '',
          prizmType:      card.prizm_type      || '',
          prizmColor:     card.prizm_color     || '',
          gradingCompany: card.grading_company || 'raw',
          grade:          card.grade          || '',
          certNumber:     card.cert_number    || '',
          condition:      card.condition      || 'near_mint',
          estimatedValue: card.estimated_value_aud != null ? String(card.estimated_value_aud) : '',
          purchasePrice:  card.purchase_price_aud != null ? String(card.purchase_price_aud) : '',
          acquiredDate:   card.acquired_date  || '',
          acquiredFrom:   card.acquired_from  || '',
          notes:          card.notes          || '',
          tradeValue:     card.trade_value_aud != null ? String(card.trade_value_aud) : '',
          listingType:    (!card.listing_type || card.listing_type === 'Private') ? 'private' : card.listing_type,
        });
        if (card.card_image) {
          const imgUrl = card.card_image.startsWith('http')
            ? card.card_image
            : supabase.storage.from('vault-images').getPublicUrl(card.card_image).data.publicUrl;
          if (!cancelled) setImagePreview(imgUrl);
        }
        if (card.card_images?.length) {
          const urls = card.card_images.map(p =>
            p.startsWith('http') ? p : supabase.storage.from('vault-images').getPublicUrl(p).data.publicUrl
          );
          const filled = Array.from({ length: 5 }, (_, i) => urls[i] ?? null);
          if (!cancelled) setExtraPreviews(filled);
        }
      } catch {
        if (!cancelled) {
          toast.error('Failed to load card');
          navigate('/vault');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchCard();
    return () => { cancelled = true; };
  }, [id, currentUser?.id, navigate, isEdit]);

  // ─── Image handling ───────────────────────────────────────────────────────
  // Score a photo against the CardPop Photography Standard (advisory only).
  const runPhotoQuality = (file) => {
    setPhotoQuality(null);
    setCheckingQuality(true);
    analyzePhotoQuality(file)
      .then(setPhotoQuality)
      .catch(() => setPhotoQuality(null))
      .finally(() => setCheckingQuality(false));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5242880) { toast.error('Image must be less than 5MB'); return; }
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
    // Clear any previous analysis results when a new image is selected
    clearScan();
    clearCardSight();
    clearCrop();
    setAdjusting(null);
    runPhotoQuality(file);
  };

  // Apply a cropped image to the given slot ('main' or an extra-photo index).
  const applyCropResult = (key, croppedFile, croppedUrl) => {
    if (key === 'main') {
      setImageFile(croppedFile);
      setImagePreview(croppedUrl);
      runPhotoQuality(croppedFile);
    } else {
      const nf = [...extraFiles]; nf[key] = croppedFile; setExtraFiles(nf);
      const np = [...extraPreviews]; np[key] = croppedUrl; setExtraPreviews(np);
    }
    clearCrop();
    toast.success('Using the cropped card image.');
  };

  const applyMainCrop = () =>
    cropCandidate && applyCropResult('main', cropCandidate.croppedFile, cropCandidate.croppedUrl);
  const applyExtraCrop = (idx) =>
    cropCandidate && applyCropResult(idx, cropCandidate.croppedFile, cropCandidate.croppedUrl);

  // Open the manual corner adjuster for a slot, seeded with detected corners
  // when available (otherwise the editor falls back to an inset rectangle).
  const openAdjuster = (key, file, imageUrl, initialCorners = null) => {
    if (!file) return;
    setAdjusting({ key, file, imageUrl, initialCorners });
  };

  // Auto-detect first; if nothing is found, drop straight into manual adjust.
  const cropOrAdjust = async (key, file, imageUrl) => {
    const found = await detectCrop(key, file);
    if (!found) openAdjuster(key, file, imageUrl);
  };

  // Warp the image with the user-adjusted corners and apply the result.
  const handleAdjustApply = async (corners) => {
    if (!adjusting) return;
    const res = await warpCardWithCorners(adjusting.file, corners);
    if (!res?.ok || !res.blob) {
      toast.error('Could not crop with those corners. Try again.');
      return;
    }
    const base = (adjusting.file.name || 'card').replace(/\.[^.]+$/, '');
    const croppedFile = new File([res.blob], `${base}-cropped.jpg`, { type: 'image/jpeg' });
    applyCropResult(adjusting.key, croppedFile, res.url);
    setAdjusting(null);
  };

  // ─── Unified AI analysis ──────────────────────────────────────────────────
  const handleAnalyzeWithAI = async () => {
    if (!imageFile) return;
    clearScan();
    clearCardSight();

    // 1. Try CardSight catalog identification first (returns result directly)
    const csResult = await cardSightIdentify(imageFile, formData.collection);

    // If CardSight service is unavailable, fall through to OCR — don't bail out
    if (csResult?.identified) {
      const fields = mapCardSightToFormFields(csResult);
      setFormData(prev => ({ ...prev, ...fields }));
      if (csResult.pricing?.avgPrice) {
        set('estimatedValue', String(csResult.pricing.avgPrice.toFixed(2)));
      }
      if (csResult.card?.id) fetchPricingById(csResult.card.id);
      else if (csResult.card?.name) fetchPricingByName(csResult.card.name);
      setIsAutoFilled(true);
      toast.success('Card identified! Fields auto-filled from catalog.');
      return;
    }

    // 2. CardSight didn't find the card — fall back to OCR
    const advisory = csResult?.serverMessages?.[0]?.message;
    if (advisory && !csResult?.apiError) toast.info(`Catalog match not found: ${advisory}`);

    const conditionMap = {
      'Mint': 'mint', 'Near Mint': 'near_mint', 'Excellent': 'excellent',
      'Good': 'good', 'Fair': 'light_played',
    };
    const gradingCompanyMap = { 'PSA': 'psa', 'BGS': 'bgs', 'CGC': 'cgc', 'SGC': 'sgc', 'ACE': 'ace' };

    // Pass the front plus any back/extra images so OCR can read set codes and
    // collector numbers that are clearer (or only present) on the back.
    const ocrResult = await scanCard([imageFile, ...extraFiles.filter(Boolean)].slice(0, 3));
    if (ocrResult) {
      setFormData(prev => ({
        ...prev,
        cardName:       ocrResult.name          || prev.cardName,
        collection:     ocrResult.collectionType || prev.collection,
        setName:        ocrResult.cardSetName   || prev.setName,
        cardNumber:     ocrResult.cardNumber    || prev.cardNumber,
        year:           ocrResult.releaseYear   || prev.year,
        condition:      conditionMap[ocrResult.condition] || prev.condition,
        grade:          ocrResult.gradeScore    || prev.grade,
        gradingCompany: ocrResult.gradingService !== 'None'
          ? (gradingCompanyMap[ocrResult.gradingService] ?? prev.gradingCompany)
          : prev.gradingCompany,
        certNumber:     ocrResult.certificationNumber || prev.certNumber,
        notes: prev.notes || [
          ocrResult.description,
          ocrResult.rarity   ? `Rarity: ${ocrResult.rarity}` : '',
          ocrResult.cardType ? `Type: ${ocrResult.cardType}` : '',
        ].filter(Boolean).join('\n') || '',
      }));
      lookupPrice(ocrResult);
      setIsAutoFilled(true);
      // Success/failure feedback is surfaced by useCardOCR itself.
    }
  };

  // ─── Photo template handlers ──────────────────────────────────────────────
  const handleFormatPhoto = async () => {
    if (!imageFile) return;
    try {
      setPhotoTemplateModal({ open: true, processType: 'template', step: 'preview' });
      await createSlabImagePreview(imageFile);
    } catch (error) {
      toast.error('Failed to format photo');
    }
  };

  const handleConfirmTemplate = async () => {
    if (!previewUrl) {
      toast.error('No formatted image to apply');
      return;
    }

    // ── New (unsaved) card ──────────────────────────────────────────────────
    // No vault item exists yet, so apply the formatted (cropped) preview to the
    // in-memory image; it uploads when the card is created.
    if (!id) {
      try {
        setIsUploadingTemplate(true);
        const blob = await previewUrlToBlob(previewUrl);
        const formattedFile = new File(
          [blob],
          `formatted-${Date.now()}.jpg`,
          { type: blob.type || 'image/jpeg' }
        );
        setImageFile(formattedFile);
        setImagePreview(previewUrl);
        setPhotoTemplateModal({ open: false, processType: null, step: 'preview' });
        resetPhotoTemplate();
        toast.success('Photo formatted — it will be saved with your card.');
      } catch (error) {
        console.error('Local format error:', error);
        toast.error('Failed to apply formatted photo');
      } finally {
        setIsUploadingTemplate(false);
      }
      return;
    }

    // ── Existing card ────────────────────────────────────────────────────────
    // Persist the formatted (cropped) preview directly. This uploads the
    // client-processed image rather than re-centering the original server-side,
    // so the cropped/background-removed result is what's saved.
    try {
      setIsUploadingTemplate(true);
      const blob = await previewUrlToBlob(previewUrl);
      const filePath = `${currentUser.id}/template-${id}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('vault-images')
        .upload(filePath, blob, { upsert: true, contentType: blob.type || 'image/jpeg' });
      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from('vault_items')
        .update({ card_image: filePath })
        .eq('id', id)
        .eq('owner_id', currentUser.id);
      if (updateError) throw updateError;

      setPhotoTemplateModal({ open: false, processType: null, step: 'preview' });
      resetPhotoTemplate();
      setImageFile(null);
      setImagePreview(supabase.storage.from('vault-images').getPublicUrl(filePath).data.publicUrl);
      toast.success('Photo formatted successfully!');
    } catch (error) {
      console.error('Template upload error:', error);
      toast.error('Failed to upload processed image');
    } finally {
      setIsUploadingTemplate(false);
    }
  };

  const closePhotoTemplateModal = () => {
    setPhotoTemplateModal({ open: false, processType: null, step: 'preview' });
    resetPhotoTemplate();
  };

  // ─── Validation ───────────────────────────────────────────────────────────
  const validateForm = () => {
    const newErrors = {};
    if (!formData.cardName?.trim()) newErrors.cardName = 'Card name is required';
    if (!formData.estimatedValue || parseFloat(formData.estimatedValue) < 0)
      newErrors.estimatedValue = 'Enter a valid estimated value';
    const yearVal = formData.year?.trim();
    if (yearVal) {
      const match = yearVal.match(/^(\d{4})(?:\/(\d{4}))?$/);
      if (!match) {
        newErrors.year = 'Enter a single year (e.g. 2025) or a range (e.g. 2025/2026)';
      } else {
        const maxYear = new Date().getFullYear() + 1;
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : null;
        if (start < 1900 || start > maxYear) {
          newErrors.year = `Year must be between 1900 and ${maxYear}`;
        } else if (end !== null && end !== start + 1) {
          newErrors.year = 'A season range must be two consecutive years (e.g. 2025/2026)';
        }
      }
    }
    if (isEdit && lockedBaseValue !== null) {
      const ev = parseFloat(formData.estimatedValue) || 0;
      if (ev < lockedBaseValue)
        newErrors.estimatedValue = `Cannot be set below the locked base value of $${lockedBaseValue.toFixed(2)}`;
      const tv = parseFloat(formData.tradeValue) || 0;
      if (tv > 0 && tv < lockedBaseValue)
        newErrors.tradeValue = `Trade value cannot be set below the locked base value of $${lockedBaseValue.toFixed(2)}`;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ─── Marketplace listing sync ─────────────────────────────────────────────
  // The marketplace reads exclusively from the `listings` table, so choosing a
  // public listing type here must create/update a matching listings row.
  // Without this the card is only flagged on the vault_items row and never
  // appears in the marketplace. Mirrors the logic in VaultListingModal.
  const syncMarketplaceListing = async (cardId) => {
    const isPublic = formData.listingType !== 'private';
    const isSale   = formData.listingType === 'For Sale' || formData.listingType === 'For Sale & Trade';
    try {
      if (!isPublic) {
        // Going private — archive any active listing.
        await supabase
          .from('listings')
          .update({ status: 'archived' })
          .eq('vault_item_id', cardId)
          .eq('seller_id', currentUser.id)
          .neq('status', 'archived');
        return;
      }

      const listingPayload = {
        vault_item_id: cardId,
        seller_id:     currentUser.id,
        listing_type:  isSale ? 'fixed' : 'trade',
        status:        'active',
        price_aud:     isSale ? (parseFloat(formData.estimatedValue) || null) : null,
        listed_at:     new Date().toISOString(),
      };

      // Reuse an existing non-archived listing if one already exists.
      const { data: existing } = await supabase
        .from('listings')
        .select('id')
        .eq('vault_item_id', cardId)
        .neq('status', 'archived')
        .maybeSingle();

      if (existing) {
        await supabase
          .from('listings')
          .update(listingPayload)
          .eq('id', existing.id)
          .eq('seller_id', currentUser.id);
      } else {
        await supabase.from('listings').insert(listingPayload);
      }
    } catch (err) {
      console.error('Listing sync error:', err);
      toast.error('Card saved, but updating its marketplace listing failed. You can re-list it from your vault.');
    }
  };

  // ─── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isEdit && !imageFile) { toast.error('Card image is required'); return; }
    // Require both Category (e.g. Sports) and Franchise (e.g. NBA). The specific
    // franchise is what places a card in its collection page (e.g. /collections/nba);
    // saving with only a broad category leaves the card out of every collection.
    if (!selCategoryId || !franchiseId) {
      toast.error('Please choose both a Category and a Franchise (e.g. Sports → NBA) so your card appears in the right collection.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      // Jump to the first problem — on a long form (especially mobile) the
      // errored field may be far off-screen.
      setTimeout(() => {
        const el = document.querySelector('.border-destructive');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.focus?.();
        }
      }, 50);
      return;
    }

    setSaving(true);
    try {
      let cardImagePath = null;
      if (imageFile) {
        const compressed = await compressImage(imageFile);
        const fileExt = compressed.name.split('.').pop();
        const filePath = `${currentUser.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('vault-images')
          .upload(filePath, compressed, { upsert: true });
        if (uploadError) throw uploadError;
        cardImagePath = filePath;
      }

      const extraImagePaths = [];
      for (const file of extraFiles) {
        if (!file) continue;
        const compressed = await compressImage(file);
        const fileExt = compressed.name.split('.').pop();
        const filePath = `${currentUser.id}/${Date.now()}-extra-${Math.random().toString(36).slice(2)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('vault-images')
          .upload(filePath, compressed, { upsert: true });
        if (uploadError) throw uploadError;
        extraImagePaths.push(filePath);
      }

      const isGraded  = formData.gradingCompany !== 'raw';
      const isPublic  = formData.listingType !== 'private';
      const tradeAud  = parseFloat(formData.tradeValue) || 0;

      const payload = {
        owner_id:            currentUser.id,
        category_id:         selCategoryId || null,
        franchise_id:        franchiseId || null,
        manufacturer_id:     manufacturerId || null,
        team_id:             teamId || null,
        set_id:              setId || null,
        parallel_id:         parallelId || null,
        subset_id:           subsetId   || null,
        collection:          formData.collection  || null,
        card_name:           formData.cardName.trim(),
        set_name:            formData.setName?.trim()     || null,
        card_number:         formData.cardNumber?.trim()  || null,
        year:                formData.year?.trim() || null,
        variant:             formData.variant.length ? formData.variant.join(', ') : null,
        is_foil:             formData.isFoil,
        is_sealed:           formData.isSealed,
        is_rookie:           formData.isRookie,
        is_refractor:        formData.variant.includes('Refractor'),
        serial_number:       formData.serialNumber?.trim() || null,
        is_auto:             formData.isAuto,
        auto_type:           formData.variant.includes('Auto') ? (formData.autoType || null) : null,
        auto_signers:        formData.variant.includes('Auto') ? (formData.autoSigners || 1) : null,
        patch_type:          formData.variant.includes('Patch') ? (formData.patchType || null) : null,
        patch_pieces:        formData.variant.includes('Patch') ? (formData.patchPieces || 1) : null,
        relic_material:      formData.variant.includes('Relic / Jersey') ? (formData.relicMaterial || null) : null,
        relic_source:        formData.variant.includes('Relic / Jersey') ? (formData.relicSource || null) : null,
        serial_position:     formData.variant.includes('Numbered') && formData.serialPosition ? (parseInt(formData.serialPosition, 10) || null) : null,
        serial_print_run:    formData.variant.includes('Numbered') && formData.serialPrintRun ? (parseInt(formData.serialPrintRun, 10) || null) : null,
        sp_variation:        formData.variant.includes('Short Print (SP)') ? (formData.spVariation || null) : null,
        sp_tier:             formData.variant.includes('Short Print (SP)') ? (formData.spTier || null) : null,
        rookie_type:         formData.variant.includes('Rookie Card (RC)') ? (formData.rookieType || null) : null,
        rookie_logo:         formData.variant.includes('Rookie Card (RC)') ? (formData.rookieLogo || null) : null,
        refractor_type:      formData.variant.includes('Refractor') ? (formData.refractorType || null) : null,
        refractor_color:     formData.variant.includes('Refractor') ? (formData.refractorColor || null) : null,
        prizm_type:          formData.variant.includes('Prizm') ? (formData.prizmType || null) : null,
        prizm_color:         formData.variant.includes('Prizm') ? (formData.prizmColor || null) : null,
        grading_company:     formData.gradingCompany,
        grade:               isGraded ? (formData.grade?.trim() || null) : null,
        cert_number:         isGraded ? (formData.certNumber?.trim() || null) : null,
        condition:           formData.condition,
        estimated_value_aud: parseFloat(formData.estimatedValue) || 0,
        purchase_price_aud:  parseFloat(formData.purchasePrice)  || null,
        acquired_date:       formData.acquiredDate || null,
        acquired_from:       formData.acquiredFrom?.trim() || null,
        notes:               formData.notes?.trim()       || null,
        trade_value_aud:     tradeAud,
        trade_value_locked:  tradeAud > 0,
        listing_type:        isPublic ? formData.listingType : 'Private',
        is_public:           isPublic,
        // Persist CardSight ID if we got an exact match during this session
        ...(cardSightResult?.exactMatch && cardSightResult?.card?.id
          ? {
              cardsight_card_id: cardSightResult.card.id,
              cardsight_set_id:  cardSightResult.card.setId ?? null,
              cardsight_identified_at: new Date().toISOString(),
            }
          : {}),
      };

      if (cardImagePath) payload.card_image = cardImagePath;
      if (extraImagePaths.length) payload.card_images = extraImagePaths;

      if (isEdit) {
        const { error } = await supabase.from('vault_items').update(payload).eq('id', id).eq('owner_id', currentUser.id);
        if (error) throw error;
        await syncMarketplaceListing(id);
        toast.success('Card updated successfully!');
        navigate('/vault');
      } else {
        const { data: inserted, error } = await supabase.from('vault_items').insert(payload).select('id').single();
        if (error) throw error;
        await syncMarketplaceListing(inserted.id);
        toast.success('Card added to your vault!', {
          action: {
            label: 'Add Another',
            onClick: () => {
              setFormData({ ...emptyForm, collection: formData.collection });
              setImageFile(null);
              setImagePreview(null);
              setExtraFiles([null, null, null, null, null]);
              setExtraPreviews([null, null, null, null, null]);
              setErrors({});
              setIsAutoFilled(false);
              clearCrop();
              setAdjusting(null);
              clearScan();
              // Keep franchise/manufacturer selected for fast repeat entry
              window.scrollTo(0, 0);
            },
          },
        });
        navigate('/vault');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to save card');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="pt-32 text-center flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading...
    </div>
  );

  const isGraded = formData.gradingCompany !== 'raw';

  return (
    <div className="bg-muted/30 font-sans">
      <Helmet><title>{isEdit ? 'Edit Card' : 'Add New Card'} | Card Pop</title></Helmet>

      <div className="max-w-5xl mx-auto px-4 py-8 w-full">
        <nav className="flex items-center text-sm text-muted-foreground mb-6 font-medium">
          <Link to="/vault" className="hover:text-primary transition-colors">Vault</Link>
          <ChevronRight className="w-4 h-4 mx-2 opacity-50" />
          <span className="text-foreground">{isEdit ? 'Edit Card' : 'Add New Card'}</span>
        </nav>

        <div className="flex items-center justify-between mb-8">
          <h1 className="font-serif text-4xl font-bold">{isEdit ? 'Edit Card Details' : 'Add New Card'}</h1>
          <Button variant="ghost" asChild className="text-muted-foreground">
            <Link to="/vault"><ArrowLeft className="w-4 h-4 mr-2" /> Back</Link>
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-6">

            {/* ── Left: Image + AI ── */}
            <div className="lg:col-span-1 space-y-5">
              <div className="premium-card p-6 bg-card">
                <div className="flex items-center justify-between mb-4">
                  <Label className="font-bold text-base">
                    Card Image <span className="text-destructive">*</span>
                  </Label>
                  <Link
                    to="/photography-standard"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    Photo guide
                  </Link>
                </div>
                <div className="aspect-[3/4] bg-muted/50 rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center relative overflow-hidden group transition-colors hover:border-primary/50 hover:bg-primary/5">
                  {imagePreview ? (
                    <>
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <p className="text-white font-medium flex items-center gap-2"><Upload className="w-4 h-4" /> Change Image</p>
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-6">
                      <ImageIcon className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50 group-hover:text-primary group-hover:opacity-100 transition-colors" />
                      <p className="text-sm font-medium text-foreground mb-1">Drag & drop or click</p>
                      <p className="text-xs text-muted-foreground">JPG, PNG, WebP up to 5MB</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>

                {/* Auto-crop (opt-in): button → detecting → preview + confirm */}
                {imageFile && !(cropCandidate?.key === 'main') && (
                  <div className="mt-3 flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => cropOrAdjust('main', imageFile, imagePreview)}
                      disabled={detectingKey !== null}
                      className="flex-1 gap-1.5"
                    >
                      {detectingKey === 'main'
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Detecting card edges…</>
                        : <><Crop className="w-3.5 h-3.5" /> Straighten &amp; crop to card</>}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => openAdjuster('main', imageFile, imagePreview)}
                      disabled={detectingKey !== null}
                      title="Adjust crop corners manually"
                      className="gap-1.5"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" /> Adjust
                    </Button>
                  </div>
                )}

                {cropCandidate?.key === 'main' && (
                  <CardCropPreview
                    originalUrl={imagePreview}
                    croppedUrl={cropCandidate.croppedUrl}
                    onApply={applyMainCrop}
                    onAdjust={() => openAdjuster('main', imageFile, imagePreview, cropCandidate.corners)}
                    onDismiss={clearCrop}
                  />
                )}

                {/* Extra image slots — up to 5 additional photos */}
                <div className="mt-4">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Additional Photos (up to 5)</p>
                  <div className="grid grid-cols-5 gap-2">
                    {extraFiles.map((_, idx) => (
                      <div key={idx} className="aspect-square">
                        {extraPreviews[idx] ? (
                          <div className="relative w-full h-full rounded-lg overflow-hidden border-2 border-primary/30 group">
                            <img
                              src={extraPreviews[idx]}
                              alt={`Extra ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const nf = [...extraFiles]; nf[idx] = null;
                                const np = [...extraPreviews]; np[idx] = null;
                                setExtraFiles(nf); setExtraPreviews(np);
                                if (cropCandidate?.key === idx) clearCrop();
                              }}
                              aria-label="Remove photo"
                              className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-2.5 h-2.5 text-white" />
                            </button>
                            <button
                              type="button"
                              title="Straighten & crop to card"
                              aria-label="Straighten and crop to card"
                              onClick={() => cropOrAdjust(idx, extraFiles[idx], extraPreviews[idx])}
                              disabled={detectingKey !== null}
                              className="absolute bottom-0.5 left-0.5 bg-black/60 rounded-full p-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity disabled:opacity-40"
                            >
                              {detectingKey === idx
                                ? <Loader2 className="w-2.5 h-2.5 text-white animate-spin" />
                                : <Crop className="w-2.5 h-2.5 text-white" />}
                            </button>
                          </div>
                        ) : (
                          <label className="flex w-full h-full rounded-lg border-2 border-dashed border-border bg-muted/30 items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
                            <Plus className="w-4 h-4 text-muted-foreground" />
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="sr-only"
                              onChange={(e) => {
                                const file = e.target.files[0];
                                if (!file) return;
                                if (file.size > 5242880) { toast.error('Image must be less than 5MB'); return; }
                                const nf = [...extraFiles]; nf[idx] = file;
                                setExtraFiles(nf);
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  const np = [...extraPreviews]; np[idx] = reader.result;
                                  setExtraPreviews(np);
                                };
                                reader.readAsDataURL(file);
                                e.target.value = '';
                              }}
                            />
                          </label>
                        )}
                      </div>
                    ))}
                  </div>

                  {typeof cropCandidate?.key === 'number' && (
                    <CardCropPreview
                      originalUrl={extraPreviews[cropCandidate.key]}
                      croppedUrl={cropCandidate.croppedUrl}
                      onApply={() => applyExtraCrop(cropCandidate.key)}
                      onAdjust={() => openAdjuster(cropCandidate.key, extraFiles[cropCandidate.key], extraPreviews[cropCandidate.key], cropCandidate.corners)}
                      onDismiss={clearCrop}
                    />
                  )}
                </div>

                {adjusting && (
                  <CardCornerAdjuster
                    imageUrl={adjusting.imageUrl}
                    initialCorners={adjusting.initialCorners}
                    onApply={handleAdjustApply}
                    onCancel={() => setAdjusting(null)}
                  />
                )}

                {/* Photo Template & Card Identification */}
                <div className="mt-4 space-y-3">
                  {/* Format Photo Button - Always available when image is present */}
                  {imageFile && !isPhotoProcessing && !isUploadingTemplate && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleFormatPhoto}
                      disabled={isPhotoProcessing || isUploadingTemplate}
                      className="w-full"
                    >
                      <Frame className="w-4 h-4 mr-2" />
                      Format Photo
                    </Button>
                  )}

                  {isPhotoProcessing || isUploadingTemplate ? (
                    <div className="p-3 rounded-xl border border-border bg-muted/30 animate-in fade-in">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                        <Loader2 className="w-3 h-3 animate-spin" /> Processing photo…
                      </p>
                    </div>
                  ) : null}

                  {/* Identify Card Button - AI analysis with recommended label */}
                  {imageFile && !isScanning && !isIdentifying && !isPhotoProcessing && !isUploadingTemplate && (
                    <div className="space-y-1">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleAnalyzeWithAI}
                        className="w-full bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 border border-emerald-500/20 dark:text-emerald-400"
                      >
                        <Sparkles className="w-4 h-4 mr-2" /> Identify Card
                      </Button>
                      <p className="text-xs text-center text-muted-foreground">(Recommended)</p>
                    </div>
                  )}

                  {(isScanning || isIdentifying) && (
                    <div className="p-3 rounded-xl border border-border bg-muted/30 animate-in fade-in">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                        <Loader2 className="w-3 h-3 animate-spin" /> Analyzing card…
                      </p>
                    </div>
                  )}

                  {/* No-match state — analysis finished but card not found */}
                  {!isScanning && !isIdentifying && cardSightResult && !cardSightResult.identified && !scanResult && (
                    <div className="p-3 rounded-xl border border-border bg-muted/30 animate-in fade-in">
                      <p className="text-xs text-muted-foreground">Card not found in catalog. Try a clearer image or fill in the details manually.</p>
                    </div>
                  )}

                  {/* Combined AI results panel — shown after analysis completes */}
                  {!isScanning && !isIdentifying && (cardSightResult?.identified || scanResult) && (
                    <div className={`p-3 rounded-xl border animate-in fade-in ${cardSightResult?.identified ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-primary/5 border-primary/20'}`}>
                      <h4 className={`text-xs font-bold mb-2 flex items-center gap-1.5 ${cardSightResult?.identified ? 'text-emerald-700' : 'text-primary'}`}>
                        <Sparkles className="w-3.5 h-3.5" />
                        {cardSightResult?.identified
                          ? `Catalog Match — ${cardSightResult.exactMatch ? 'Exact' : 'Set'}`
                          : 'AI Analysis — fields auto-filled'}
                      </h4>

                      {cardSightResult?.identified && cardSightResult.confidence !== undefined && (
                        <div className="mb-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-semibold text-muted-foreground">Match Confidence</span>
                            <span className={`text-xs font-bold ${
                              cardSightResult.confidence >= 0.95 ? 'text-emerald-700 dark:text-emerald-400' :
                              cardSightResult.confidence >= 0.85 ? 'text-green-700 dark:text-green-400' :
                              cardSightResult.confidence >= 0.7 ? 'text-amber-700 dark:text-amber-400' :
                              'text-orange-700 dark:text-orange-400'
                            }`}>
                              {Math.round(cardSightResult.confidence * 100)}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-muted/50 overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                cardSightResult.confidence >= 0.95 ? 'bg-emerald-500' :
                                cardSightResult.confidence >= 0.85 ? 'bg-green-500' :
                                cardSightResult.confidence >= 0.7 ? 'bg-amber-500' :
                                'bg-orange-500'
                              }`}
                              style={{ width: `${Math.round(cardSightResult.confidence * 100)}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {cardSightResult.confidence >= 0.95 ? 'Excellent match — high confidence in identification' :
                             cardSightResult.confidence >= 0.85 ? 'Good match — confident in identification' :
                             cardSightResult.confidence >= 0.7 ? 'Moderate match — review before saving' :
                             'Low match — verify details are correct'}
                          </p>
                        </div>
                      )}

                      {cardSightResult?.identified && (
                        <>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-foreground/80 mb-2">
                            {cardSightResult.card?.name && <div className="col-span-2"><strong className="text-foreground">Card:</strong> {cardSightResult.card.name}</div>}
                            {cardSightResult.card?.setName && <div><strong className="text-foreground">Set:</strong> {cardSightResult.card.setName}</div>}
                            {cardSightResult.card?.year && <div><strong className="text-foreground">Year:</strong> {cardSightResult.card.year}</div>}
                            {cardSightResult.card?.cardNumber && <div><strong className="text-foreground">No:</strong> {cardSightResult.card.cardNumber}</div>}
                            {cardSightResult.card?.manufacturer && <div><strong className="text-foreground">Brand:</strong> {cardSightResult.card.manufacturer}</div>}
                            {cardSightResult.grading && <div className="col-span-2"><strong className="text-foreground">Graded:</strong> {cardSightResult.grading.company} {cardSightResult.grading.grade}</div>}
                            {cardSightResult.parallel && <div className="col-span-2"><strong className="text-foreground">Parallel:</strong> {cardSightResult.parallel.name ?? 'Yes'}</div>}
                          </div>
                          {cardSightResult.pricing && (
                            <div className="text-xs text-emerald-800 bg-emerald-500/10 rounded-lg px-2.5 py-2 mb-2">
                              <strong>Market Pricing</strong> ({cardSightResult.pricing.salesCount} sales) —
                              Avg: <strong>${cardSightResult.pricing.avgPrice?.toFixed(2)}</strong> &nbsp;
                              Low: ${cardSightResult.pricing.minPrice?.toFixed(2)} &nbsp;
                              High: ${cardSightResult.pricing.maxPrice?.toFixed(2)}
                            </div>
                          )}
                        </>
                      )}

                      {scanResult && !cardSightResult?.identified && (
                        <>
                          {scanResult.catalogueMatch && (
                            <div className="text-[11px] font-semibold text-emerald-700 bg-emerald-500/10 rounded-lg px-2.5 py-1.5 mb-2">
                              ✓ Matched to catalogue ({scanResult.catalogueMatch.source}) — set &amp; card number verified
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-foreground/80 mb-2">
                            {scanResult.name && <div className="col-span-2"><strong className="text-foreground">Name:</strong> {scanResult.name}</div>}
                            {scanResult.collectionType && <div><strong className="text-foreground">Category:</strong> {scanResult.collectionType}</div>}
                            {scanResult.condition && <div><strong className="text-foreground">Condition:</strong> {scanResult.condition}</div>}
                            {scanResult.cardSetName && <div><strong className="text-foreground">Set:</strong> {scanResult.cardSetName}</div>}
                            {scanResult.cardNumber && <div><strong className="text-foreground">No:</strong> {scanResult.cardNumber}</div>}
                            {scanResult.gradeScore && <div><strong className="text-foreground">Grade:</strong> {scanResult.gradeScore}</div>}
                            {scanResult.rarity && <div className="col-span-2"><strong className="text-foreground">Rarity:</strong> {scanResult.rarity}</div>}
                          </div>
                        </>
                      )}

                      <div className="pt-2 border-t border-border/50">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-xs w-full"
                          onClick={() => { clearScan(); clearCardSight(); setIsAutoFilled(false); }}
                        >
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Right: All form sections ── */}
            <div className="lg:col-span-2 space-y-5">

              {/* ── 1. Card Identity ── */}
              <SectionCard title="Card Details">
                {isAutoFilled && (
                  <div className="flex items-center text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-md w-fit -mt-2">
                    <Sparkles className="w-3 h-3 mr-1" /> AI Auto-filled — review before saving
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-4">
                  {/* Category → Franchise → Manufacturer */}
                  <CardHierarchySelector
                    categoryId={selCategoryId}
                    franchiseId={franchiseId}
                    manufacturerId={manufacturerId}
                    teamId={teamId}
                    setId={setId}
                    onCategoryChange={setSelCategoryId}
                    onFranchiseChange={(id, name) => {
                      setFranchiseId(id);
                      set('collection', name);
                    }}
                    onManufacturerChange={setManufacturerId}
                    onTeamChange={setTeamId}
                    onSetChange={(id, name) => {
                      setSetId(id);
                      if (name) set('setName', name);
                    }}
                    highlighted={isAutoFilled}
                  />

                  {/* Parallel / Variation — shown once franchise is selected and has parallels */}
                  {parallelOpts.length > 0 && (
                    <div className="md:col-span-2 space-y-2">
                      <Label className="font-bold">Parallel / Variation</Label>
                      <Select value={parallelId || '__none__'} onValueChange={v => setParallelId(v === '__none__' ? '' : v)}>
                        <SelectTrigger className="h-11 bg-background">
                          <SelectValue placeholder="Select parallel…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">No parallel (base)</SelectItem>
                          <SelectSeparator />
                          {parallelOpts.map(p => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}{p.print_run ? ` /${p.print_run}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Subset / Insert Set — shown once a set is selected and has subsets */}
                  {subsetOpts.length > 0 && (
                    <div className="md:col-span-2 space-y-2">
                      <Label className="font-bold">Subset / Insert Set</Label>
                      <Select value={subsetId || '__none__'} onValueChange={v => setSubsetId(v === '__none__' ? '' : v)}>
                        <SelectTrigger className="h-11 bg-background">
                          <SelectValue placeholder="Select subset…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">No subset (base set card)</SelectItem>
                          <SelectSeparator />
                          {subsetOpts.map(s => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Card Name */}
                  <div className="space-y-2">
                    <Label htmlFor="cardName" className="font-bold">Card Name <span className="text-destructive">*</span></Label>
                    <Input
                      id="cardName"
                      value={formData.cardName}
                      onChange={e => set('cardName', e.target.value)}
                      placeholder="e.g. Charizard"
                      className={`h-11 bg-background ${isAutoFilled ? 'border-primary/50 ring-1 ring-primary/20' : ''} ${errors.cardName ? 'border-destructive' : ''}`}
                    />
                    {errors.cardName && <p className="text-destructive text-xs">{errors.cardName}</p>}
                  </div>

                  {/* Era / Set Name — read-only if a set was picked from the hierarchy */}
                  <div className="space-y-2">
                    <Label className="font-bold">Set Name</Label>
                    {setId ? (
                      <div className="flex items-center gap-2">
                        <div className="h-11 flex-1 flex items-center px-3 rounded-md border border-border bg-muted/40 text-sm text-foreground">
                          {formData.setName}
                        </div>
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:text-destructive underline whitespace-nowrap"
                          onClick={() => { setSetId(''); set('setName', ''); }}
                        >
                          Clear
                        </button>
                      </div>
                    ) : (
                      <Input
                        id="setName"
                        value={formData.setName}
                        onChange={e => set('setName', e.target.value)}
                        placeholder="e.g. 2024-25 Prizm Basketball"
                        className="h-11 bg-background"
                      />
                    )}
                  </div>

                  {/* Card Number */}
                  <div className="space-y-2">
                    <Label htmlFor="cardNumber" className="font-bold">Card Number</Label>
                    <Input
                      id="cardNumber"
                      value={formData.cardNumber}
                      onChange={e => set('cardNumber', e.target.value)}
                      placeholder="e.g. 4/102 or 001/165"
                      className="h-11 bg-background"
                    />
                  </div>

                  {/* Year */}
                  <div className="space-y-2">
                    <Label htmlFor="year" className="font-bold">Year</Label>
                    <Input
                      id="year"
                      type="text"
                      inputMode="numeric"
                      value={formData.year}
                      onChange={e => set('year', e.target.value)}
                      placeholder={`${new Date().getFullYear()} or ${new Date().getFullYear()}/${new Date().getFullYear() + 1}`}
                      className={`h-11 bg-background ${errors.year ? 'border-destructive' : ''}`}
                    />
                    <p className="text-muted-foreground text-xs">Enter a single year (e.g. 2025) or a season range (e.g. 2025/2026).</p>
                    {errors.year && <p className="text-destructive text-xs">{errors.year}</p>}
                  </div>

                  {/* Variant / Finish — multi-select */}
                  <div className="space-y-3 md:col-span-2">
                    <div className="flex items-center justify-between">
                      <Label className="font-bold">Card Variant / Finish</Label>
                      {formData.variant.length > 0 && (
                        <button
                          type="button"
                          onClick={() => set('variant', [])}
                          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                        >
                          Clear all
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground -mt-1">
                      {formData.collection
                        ? `Showing foils & variants for ${formData.collection} — select all that apply`
                        : 'Select all that apply — scroll to see more'}
                    </p>
                    <div className="max-h-52 overflow-y-auto rounded-xl border border-border bg-muted/20 p-3 space-y-3">
                      {(() => {
                        const variantGroups = getVariantGroups(formData.collection);
                        const known = new Set(variantGroups.flatMap(g => g.variants));
                        const otherSelected = formData.variant.filter(v => !known.has(v));
                        const renderChip = (v) => {
                          const active = formData.variant.includes(v);
                          return (
                            <button
                              key={v}
                              type="button"
                              onClick={() => set('variant', active ? formData.variant.filter(x => x !== v) : [...formData.variant, v])}
                              className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                                active
                                  ? 'border-primary bg-primary/10 text-primary shadow-sm'
                                  : 'border-border bg-background text-foreground hover:border-muted-foreground/40'
                              }`}
                            >
                              {active && <span className="mr-1">✓</span>}{v}
                            </button>
                          );
                        };
                        return (
                          <>
                            {variantGroups.map(group => (
                              <div key={group.label}>
                                <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground mb-1.5">{group.label}</p>
                                <div className="flex flex-wrap gap-2">
                                  {group.variants.map(renderChip)}
                                </div>
                              </div>
                            ))}
                            {otherSelected.length > 0 && (
                              <div>
                                <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground mb-1.5">Also Selected</p>
                                <div className="flex flex-wrap gap-2">
                                  {otherSelected.map(renderChip)}
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                    {formData.variant.length > 0 && (
                      <p className="text-xs text-primary font-medium">
                        Selected: {formData.variant.join(' · ')}
                      </p>
                    )}
                  </div>

                  {/* Condition */}
                  <div className="space-y-2">
                    <Label className="font-bold">Condition <span className="text-destructive">*</span></Label>
                    <Select value={formData.condition} onValueChange={v => set('condition', v)}>
                      <SelectTrigger className={`h-11 bg-background ${isAutoFilled ? 'border-primary/50 ring-1 ring-primary/20' : ''}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mint">Mint</SelectItem>
                        <SelectItem value="near_mint">Near Mint</SelectItem>
                        <SelectItem value="excellent">Excellent</SelectItem>
                        <SelectItem value="good">Good</SelectItem>
                        <SelectItem value="light_played">Light Played</SelectItem>
                        <SelectItem value="played">Played</SelectItem>
                        <SelectItem value="poor">Poor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Card Attributes toggles */}
                  <div className="space-y-2 md:col-span-2">
                    <Label className="font-bold">Card Attributes</Label>
                    <div className="flex gap-3">
                      {[
                        { key: 'isFoil',   label: '🃏 Individual Card (Single)', desc: 'A single individual card' },
                        { key: 'isSealed', label: '📦 Sealed Product', desc: 'Booster, box, or sealed item' },
                        { key: 'isRookie', label: '🏆 Rookie Card',    desc: 'First-year professional card' },
                      ].map(({ key, label, desc }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => set(key, !formData[key])}
                          className={`flex-1 flex flex-col items-start px-4 py-3 rounded-xl border-2 text-left transition-all ${
                            formData[key]
                              ? 'border-primary bg-primary/10 text-primary shadow-sm'
                              : 'border-border bg-background hover:border-muted-foreground/40 text-foreground'
                          }`}
                        >
                          <span className="font-bold text-sm">{label}</span>
                          <span className={`text-xs mt-0.5 ${formData[key] ? 'text-primary/70' : 'text-muted-foreground'}`}>{desc}</span>
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-3 items-stretch">
                      {[
                        { key: 'isAuto',      label: '🗂️ Complete Set',  desc: 'A full / complete set' },
                      ].map(({ key, label, desc }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => set(key, !formData[key])}
                          className={`flex-1 flex flex-col items-start px-4 py-3 rounded-xl border-2 text-left transition-all ${
                            formData[key]
                              ? 'border-primary bg-primary/10 text-primary shadow-sm'
                              : 'border-border bg-background hover:border-muted-foreground/40 text-foreground'
                          }`}
                        >
                          <span className="font-bold text-sm">{label}</span>
                          <span className={`text-xs mt-0.5 ${formData[key] ? 'text-primary/70' : 'text-muted-foreground'}`}>{desc}</span>
                        </button>
                      ))}
                      <div className={`flex-1 flex flex-col px-4 py-3 rounded-xl border-2 transition-all ${
                        formData.serialNumber
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-background'
                      }`}>
                        <span className={`font-bold text-sm mb-1 ${formData.serialNumber ? 'text-primary' : 'text-foreground'}`}>🔢 Serial #</span>
                        <input
                          type="text"
                          placeholder="e.g. 42/99"
                          value={formData.serialNumber}
                          onChange={e => set('serialNumber', e.target.value)}
                          className="bg-transparent text-xs outline-none placeholder:text-muted-foreground w-full"
                        />
                      </div>
                    </div>

                    {/* Refractor sub-details — shown when the "Refractor" finish is
                        selected in the Card Variant / Finish section (Finish group). */}
                    {formData.variant.includes('Refractor') && (
                      <div className="mt-3 p-4 rounded-xl border-2 border-fuchsia-400/30 bg-fuchsia-400/5 space-y-4 animate-in fade-in slide-in-from-top-1">
                        <p className="text-xs font-extrabold uppercase tracking-widest text-fuchsia-700 dark:text-fuchsia-400">Refractor Details</p>

                        {/* Refractor type / pattern */}
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-foreground">Refractor Type</Label>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { value: 'base',         label: 'Base Refractor',     desc: 'Standard rainbow-shine refractor finish' },
                              { value: 'xfractor',     label: 'X-Fractor',          desc: 'Checkerboard / mosaic background pattern' },
                              { value: 'atomic',       label: 'Atomic Refractor',   desc: "Cracked-ice 'atomic' finish — scarcer than base" },
                              { value: 'prism',        label: 'Prism Refractor',    desc: 'Prismatic light-beam pattern' },
                              { value: 'pulsar',       label: 'Pulsar Refractor',   desc: 'Starburst / pulsar burst pattern' },
                              { value: 'mojo',         label: 'Mojo Refractor',     desc: "Rippling 'mojo' wave finish" },
                              { value: 'wave',         label: 'Wave Refractor',     desc: 'Flowing wave-line pattern' },
                              { value: 'mini_diamond', label: 'Mini-Diamond',       desc: 'Tiny repeating diamond texture' },
                              { value: 'speckle',      label: 'Speckle Refractor',  desc: 'Speckled / sparkle finish' },
                              { value: 'shimmer',      label: 'Shimmer Refractor',  desc: 'High-gloss shimmer finish' },
                              { value: 'raywave',      label: 'RayWave Refractor',  desc: 'Topps Finest ray-wave pattern' },
                              { value: 'negative',     label: 'Negative Refractor', desc: 'Inverted / negative colour finish' },
                              { value: 'sepia',        label: 'Sepia Refractor',    desc: 'Reddish-brown monochrome tone' },
                              { value: 'superfractor', label: 'Superfractor (1/1)', desc: 'The one-of-one gold swirl — rarest of all' },
                              { value: 'other',        label: 'Other Refractor',    desc: 'Another refractor-style parallel' },
                            ].map(({ value, label, desc }) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => set('refractorType', formData.refractorType === value ? '' : value)}
                                className={`flex flex-col items-start px-3 py-2.5 rounded-xl border-2 text-left transition-all ${
                                  formData.refractorType === value
                                    ? 'border-fuchsia-500 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-400 shadow-sm'
                                    : 'border-border bg-background hover:border-muted-foreground/40 text-foreground'
                                }`}
                              >
                                <span className="font-bold text-xs">{label}</span>
                                <span className={`text-[10px] mt-0.5 leading-tight ${formData.refractorType === value ? 'text-fuchsia-600/70 dark:text-fuchsia-400/70' : 'text-muted-foreground'}`}>{desc}</span>
                              </button>
                            ))}
                          </div>

                          {/* Collapsible refractor guide */}
                          <div className="rounded-xl border border-fuchsia-400/25 overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setShowRefractorGuide(v => !v)}
                              className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-fuchsia-400/5 transition-colors"
                            >
                              <span className="text-[11px] font-bold text-fuchsia-700 dark:text-fuchsia-400">How do refractors work? View guide</span>
                              <ChevronDown className={`h-3.5 w-3.5 text-fuchsia-600 dark:text-fuchsia-400 transition-transform duration-200 ${showRefractorGuide ? 'rotate-180' : ''}`} />
                            </button>
                            {showRefractorGuide && (
                              <div className="px-3 pb-3 divide-y divide-border/40">
                                {[
                                  {
                                    title: 'What is a refractor?',
                                    badge: 'Basics',
                                    badgeClass: 'bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-400 border border-fuchsia-500/20',
                                    body: "A refractor is a chromium parallel (pioneered by Topps Finest in 1993) with a reflective coating that throws a rainbow shine when tilted under light. The same card design is printed across many refractor 'parallels' that differ by colour and pattern.",
                                  },
                                  {
                                    title: 'Colour = rarity',
                                    badge: 'Hierarchy',
                                    badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20',
                                    body: 'Colour usually signals scarcity. Base and Green/Blue are the most common; Gold is typically /50, Orange /25, Black /10 and Red /5. Exact print runs vary by set and year, so always check the back for the serial number.',
                                  },
                                  {
                                    title: 'Superfractor',
                                    badge: '1-of-1',
                                    badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20',
                                    body: 'The rarest refractor of all — a serial-numbered 1/1 with a swirling gold finish. Only a single copy of each card exists, making Superfractors among the most coveted cards in the hobby.',
                                  },
                                  {
                                    title: 'X-Fractor & Atomic',
                                    badge: 'Patterns',
                                    badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20',
                                    body: "X-Fractors carry a checkerboard / mosaic background, while Atomic Refractors (Bowman's Best) use a cracked-ice texture and are typically far scarcer than the base refractor.",
                                  },
                                  {
                                    title: 'Modern patterns',
                                    badge: 'Modern',
                                    badgeClass: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border border-violet-500/20',
                                    body: 'Newer releases add pattern refractors such as Prism, Pulsar, Mojo, Wave, Speckle, Shimmer and RayWave — each a distinct texture layered over the refractor finish.',
                                  },
                                  {
                                    title: 'Negative & Sepia',
                                    badge: 'Monochrome',
                                    badgeClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20',
                                    body: 'Negative Refractors invert the card colours for a dark, high-contrast look, while Sepia Refractors drop the colour for a reddish-brown monochrome tone.',
                                  },
                                ].map(({ title, badge, badgeClass, body }) => (
                                  <div key={title} className="py-2.5 first:pt-2">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-[11px] font-bold text-foreground">{title}</span>
                                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${badgeClass}`}>{badge}</span>
                                    </div>
                                    <p className="text-[10px] leading-relaxed text-muted-foreground">{body}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Refractor colour / parallel */}
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-foreground">Refractor Colour / Parallel</Label>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { value: 'standard', label: 'Standard', sub: 'Unnumbered',  dot: 'bg-gradient-to-br from-cyan-300 via-fuchsia-300 to-amber-300' },
                              { value: 'green',    label: 'Green',    sub: 'often /99',   dot: 'bg-green-500' },
                              { value: 'purple',   label: 'Purple',   sub: 'scarce',      dot: 'bg-purple-500' },
                              { value: 'blue',     label: 'Blue',     sub: 'often /150',  dot: 'bg-blue-500' },
                              { value: 'aqua',     label: 'Aqua',     sub: 'retail',      dot: 'bg-cyan-400' },
                              { value: 'pink',     label: 'Pink',     sub: 'retail',      dot: 'bg-pink-400' },
                              { value: 'yellow',   label: 'Yellow',   sub: 'set-based',   dot: 'bg-yellow-400' },
                              { value: 'gold',     label: 'Gold',     sub: 'often /50',   dot: 'bg-amber-400' },
                              { value: 'orange',   label: 'Orange',   sub: 'often /25',   dot: 'bg-orange-500' },
                              { value: 'black',    label: 'Black',    sub: 'often /10',   dot: 'bg-neutral-900 border border-white/40' },
                              { value: 'red',      label: 'Red',      sub: 'often /5',    dot: 'bg-red-500' },
                            ].map(({ value, label, sub, dot }) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => set('refractorColor', formData.refractorColor === value ? '' : value)}
                                className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border-2 text-left transition-all ${
                                  formData.refractorColor === value
                                    ? 'border-fuchsia-500 bg-fuchsia-500/10 shadow-sm'
                                    : 'border-border bg-background hover:border-muted-foreground/40'
                                }`}
                              >
                                <span className={`h-4 w-4 rounded-full shrink-0 ${dot}`} aria-hidden="true" />
                                <span className="flex flex-col leading-tight">
                                  <span className={`font-bold text-xs ${formData.refractorColor === value ? 'text-fuchsia-700 dark:text-fuchsia-400' : 'text-foreground'}`}>{label}</span>
                                  <span className={`text-[10px] ${formData.refractorColor === value ? 'text-fuchsia-600/70 dark:text-fuchsia-400/70' : 'text-muted-foreground'}`}>{sub}</span>
                                </span>
                              </button>
                            ))}
                          </div>
                          <p className="text-[10px] text-muted-foreground leading-relaxed">Print runs vary by set and year — the values shown are typical guides. Use the Serial # field above to record the exact numbering.</p>
                        </div>
                      </div>
                    )}

                    {/* Prizm sub-details — shown when the "Prizm" finish is
                        selected in the Card Variant / Finish section (Finish group).
                        The individual Prizm colours/patterns live here rather than
                        as separate chips above. */}
                    {formData.variant.includes('Prizm') && (
                      <div className="mt-3 p-4 rounded-xl border-2 border-indigo-400/30 bg-indigo-400/5 space-y-4 animate-in fade-in slide-in-from-top-1">
                        <p className="text-xs font-extrabold uppercase tracking-widest text-indigo-700 dark:text-indigo-400">Prizm Details</p>

                        {/* Prizm type / pattern */}
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-foreground">Prizm Type / Pattern</Label>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { value: 'base',        label: 'Base (Silver) Prizm', desc: 'Standard silver chrome Prizm parallel' },
                              { value: 'hyper',       label: 'Hyper Prizm',         desc: 'Retail hyper pattern' },
                              { value: 'disco',       label: 'Disco Prizm',         desc: 'Diamond-sparkle disco pattern' },
                              { value: 'mojo',        label: 'Mojo Prizm',          desc: "Rippling 'mojo' wave finish" },
                              { value: 'shimmer',     label: 'Shimmer Prizm',       desc: 'High-gloss shimmer finish' },
                              { value: 'wave',        label: 'Wave Prizm',          desc: 'Flowing wave-line pattern' },
                              { value: 'pulsar',      label: 'Pulsar Prizm',        desc: 'Starburst / pulsar burst pattern' },
                              { value: 'cracked_ice', label: 'Cracked Ice Prizm',   desc: 'Cracked-ice texture' },
                              { value: 'snakeskin',   label: 'Snakeskin Prizm',     desc: 'Scaled snakeskin texture' },
                              { value: 'fast_break',  label: 'Fast Break / Flash',  desc: 'Set-specific burst pattern' },
                              { value: 'other',       label: 'Other Prizm',         desc: 'Another Prizm-style parallel' },
                            ].map(({ value, label, desc }) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => set('prizmType', formData.prizmType === value ? '' : value)}
                                className={`flex flex-col items-start px-3 py-2.5 rounded-xl border-2 text-left transition-all ${
                                  formData.prizmType === value
                                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 shadow-sm'
                                    : 'border-border bg-background hover:border-muted-foreground/40 text-foreground'
                                }`}
                              >
                                <span className="font-bold text-xs">{label}</span>
                                <span className={`text-[10px] mt-0.5 leading-tight ${formData.prizmType === value ? 'text-indigo-600/70 dark:text-indigo-400/70' : 'text-muted-foreground'}`}>{desc}</span>
                              </button>
                            ))}
                          </div>

                          {/* Collapsible prizm guide */}
                          <div className="rounded-xl border border-indigo-400/25 overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setShowPrizmGuide(v => !v)}
                              className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-indigo-400/5 transition-colors"
                            >
                              <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400">How do Prizm parallels work? View guide</span>
                              <ChevronDown className={`h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 transition-transform duration-200 ${showPrizmGuide ? 'rotate-180' : ''}`} />
                            </button>
                            {showPrizmGuide && (
                              <div className="px-3 pb-3 divide-y divide-border/40">
                                {[
                                  {
                                    title: 'What is a Prizm?',
                                    badge: 'Basics',
                                    badgeClass: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20',
                                    body: "Prizm is Panini's chrome parallel line — the equivalent of Topps' Refractor. The base chrome card is the Silver Prizm; the same design is then printed across many colour and pattern parallels that differ in scarcity.",
                                  },
                                  {
                                    title: 'Colour = rarity',
                                    badge: 'Hierarchy',
                                    badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20',
                                    body: 'Silver is the unnumbered base. Coloured parallels are usually serial-numbered — e.g. Blue /199, Orange /249, Red /299, Gold /10, with Black and Nebula typically 1-of-1. Print runs vary by set and year, so check the back for the serial number.',
                                  },
                                  {
                                    title: 'Pattern parallels',
                                    badge: 'Patterns',
                                    badgeClass: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border border-violet-500/20',
                                    body: 'Beyond plain colours, Prizm adds textured patterns such as Hyper, Disco, Mojo, Shimmer, Wave, Pulsar, Cracked Ice and Snakeskin — each a distinct finish layered over the chrome.',
                                  },
                                  {
                                    title: 'Black & Nebula 1/1s',
                                    badge: '1-of-1',
                                    badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20',
                                    body: 'Black Prizm and Nebula Prizm are typically one-of-one cards — the rarest pulls in a Prizm set and among the most coveted modern parallels.',
                                  },
                                ].map(({ title, badge, badgeClass, body }) => (
                                  <div key={title} className="py-2.5 first:pt-2">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-[11px] font-bold text-foreground">{title}</span>
                                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${badgeClass}`}>{badge}</span>
                                    </div>
                                    <p className="text-[10px] leading-relaxed text-muted-foreground">{body}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Prizm colour / parallel */}
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-foreground">Prizm Colour / Parallel</Label>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { value: 'silver', label: 'Silver', sub: 'base, unnumbered', dot: 'bg-gradient-to-br from-slate-200 via-slate-400 to-slate-200' },
                              { value: 'rwb',    label: 'Red/White/Blue', sub: 'retail',     dot: 'bg-gradient-to-br from-red-500 via-white to-blue-500 border border-white/40' },
                              { value: 'green',  label: 'Green',  sub: 'often /199',  dot: 'bg-green-500' },
                              { value: 'purple', label: 'Purple', sub: 'scarce',      dot: 'bg-purple-500' },
                              { value: 'blue',   label: 'Blue',   sub: 'often /199',  dot: 'bg-blue-500' },
                              { value: 'pink',   label: 'Pink',   sub: 'retail',      dot: 'bg-pink-400' },
                              { value: 'orange', label: 'Orange', sub: 'often /249',  dot: 'bg-orange-500' },
                              { value: 'red',    label: 'Red',    sub: 'often /299',  dot: 'bg-red-500' },
                              { value: 'gold',   label: 'Gold',   sub: 'often /10',   dot: 'bg-amber-400' },
                              { value: 'black',  label: 'Black',  sub: '1/1',         dot: 'bg-neutral-900 border border-white/40' },
                              { value: 'nebula', label: 'Nebula', sub: '1/1',         dot: 'bg-gradient-to-br from-fuchsia-500 via-indigo-500 to-cyan-400' },
                            ].map(({ value, label, sub, dot }) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => set('prizmColor', formData.prizmColor === value ? '' : value)}
                                className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border-2 text-left transition-all ${
                                  formData.prizmColor === value
                                    ? 'border-indigo-500 bg-indigo-500/10 shadow-sm'
                                    : 'border-border bg-background hover:border-muted-foreground/40'
                                }`}
                              >
                                <span className={`h-4 w-4 rounded-full shrink-0 ${dot}`} aria-hidden="true" />
                                <span className="flex flex-col leading-tight">
                                  <span className={`font-bold text-xs ${formData.prizmColor === value ? 'text-indigo-700 dark:text-indigo-400' : 'text-foreground'}`}>{label}</span>
                                  <span className={`text-[10px] ${formData.prizmColor === value ? 'text-indigo-600/70 dark:text-indigo-400/70' : 'text-muted-foreground'}`}>{sub}</span>
                                </span>
                              </button>
                            ))}
                          </div>
                          <p className="text-[10px] text-muted-foreground leading-relaxed">Print runs vary by set and year — the values shown are typical guides. Use the Serial # field above to record the exact numbering.</p>
                        </div>
                      </div>
                    )}

                    {/* Rookie sub-details — shown when the "Rookie Card (RC)" attribute
                        is selected in the Card Variant / Finish section (Attributes group). */}
                    {formData.variant.includes('Rookie Card (RC)') && (
                      <div className="mt-3 p-4 rounded-xl border-2 border-teal-400/30 bg-teal-400/5 space-y-4 animate-in fade-in slide-in-from-top-1">
                        <p className="text-xs font-extrabold uppercase tracking-widest text-teal-700 dark:text-teal-400">Rookie Card Details</p>

                        {/* Rookie designation */}
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-foreground">Rookie Designation</Label>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { value: 'true_rc',      label: 'True RC',            desc: 'Base card with the official RC logo in a licensed flagship set' },
                              { value: 'rc_logo',      label: 'RC Logo Card',       desc: 'Carries the cross-brand Rookie Card logo (2006+)' },
                              { value: 'first_bowman', label: '1st Bowman / Prospect', desc: 'First licensed prospect card from the minors or college' },
                              { value: 'pre_rookie',   label: 'Pre-Rookie (PRC)',   desc: 'A card issued before the recognised rookie card' },
                              { value: 'xrc',          label: 'Extended RC (XRC)',  desc: 'Rookie from a traded / update set' },
                              { value: 'rpa',          label: 'Rookie Patch Auto',  desc: 'Premium rookie with autograph + game-worn patch (RPA)' },
                              { value: 'rated_rookie', label: 'Rated Rookie',       desc: "Donruss's branded rookie subset" },
                              { value: 'rookie_ticket',label: 'Rookie Ticket',      desc: "Panini Contenders' autographed rookie subset" },
                              { value: 'other',        label: 'Other Rookie',       desc: 'Another rookie-related card' },
                            ].map(({ value, label, desc }) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => set('rookieType', formData.rookieType === value ? '' : value)}
                                className={`flex flex-col items-start px-3 py-2.5 rounded-xl border-2 text-left transition-all ${
                                  formData.rookieType === value
                                    ? 'border-teal-500 bg-teal-500/10 text-teal-700 dark:text-teal-400 shadow-sm'
                                    : 'border-border bg-background hover:border-muted-foreground/40 text-foreground'
                                }`}
                              >
                                <span className="font-bold text-xs">{label}</span>
                                <span className={`text-[10px] mt-0.5 leading-tight ${formData.rookieType === value ? 'text-teal-600/70 dark:text-teal-400/70' : 'text-muted-foreground'}`}>{desc}</span>
                              </button>
                            ))}
                          </div>

                          {/* Collapsible rookie guide */}
                          <div className="rounded-xl border border-teal-400/25 overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setShowRookieGuide(v => !v)}
                              className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-teal-400/5 transition-colors"
                            >
                              <span className="text-[11px] font-bold text-teal-700 dark:text-teal-400">What counts as a rookie card? View guide</span>
                              <ChevronDown className={`h-3.5 w-3.5 text-teal-600 dark:text-teal-400 transition-transform duration-200 ${showRookieGuide ? 'rotate-180' : ''}`} />
                            </button>
                            {showRookieGuide && (
                              <div className="px-3 pb-3 divide-y divide-border/40">
                                {[
                                  {
                                    title: 'True Rookie Card',
                                    badge: 'Most Valued',
                                    badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20',
                                    body: "The base card from a fully-licensed, nationally-distributed flagship set in the player's first year — not an insert, parallel, or redemption. This is the version the hobby usually recognises as the definitive RC.",
                                  },
                                  {
                                    title: 'RC Logo',
                                    badge: 'Marker',
                                    badgeClass: 'bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-500/20',
                                    body: 'Since 2006, first-year players carry a standardised cross-brand "ROOKIE CARD" logo. Useful for spotting rookies, but not every card bearing the logo is considered a true RC.',
                                  },
                                  {
                                    title: '1st Bowman / Prospect',
                                    badge: 'Pre-MLB',
                                    badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20',
                                    body: "A player's first licensed card, issued while still in the minors or college (often Bowman, with a 1st Bowman logo). Not an official RC, but frequently more sought-after than the eventual rookie.",
                                  },
                                  {
                                    title: 'Pre-Rookie & XRC',
                                    badge: 'Early Issue',
                                    badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20',
                                    body: 'Pre-Rookie (PRC) is any card before the recognised RC. XRC (Extended Rookie Card) refers to rookies that appeared in 1980s traded/update sets ahead of a flagship rookie the following year.',
                                  },
                                  {
                                    title: 'Rookie Patch Auto (RPA)',
                                    badge: 'Premium',
                                    badgeClass: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border border-violet-500/20',
                                    body: 'A premium rookie-year card pairing the player\'s autograph with a game-worn patch. Highly desirable, though not always recognised as the "true" RC unless it meets the licensed, pack-issued, widely-distributed criteria.',
                                  },
                                  {
                                    title: 'Branded Rookies',
                                    badge: 'Subset',
                                    badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20',
                                    body: 'Some sets brand their rookies — Donruss "Rated Rookie" and Panini Contenders "Rookie Ticket" are the best known. These are popular, recognisable rookie subsets in their own right.',
                                  },
                                ].map(({ title, badge, badgeClass, body }) => (
                                  <div key={title} className="py-2.5 first:pt-2">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-[11px] font-bold text-foreground">{title}</span>
                                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${badgeClass}`}>{badge}</span>
                                    </div>
                                    <p className="text-[10px] leading-relaxed text-muted-foreground">{body}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* RC logo present on card */}
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-foreground">Official RC Logo on Card?</Label>
                          <div className="flex gap-2">
                            {[
                              { value: 'yes', label: 'Yes',  sub: 'Logo printed' },
                              { value: 'no',  label: 'No',   sub: 'No RC logo' },
                              { value: 'na',  label: 'N/A',  sub: 'Pre-2006 / vintage' },
                            ].map(({ value, label, sub }) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => set('rookieLogo', formData.rookieLogo === value ? '' : value)}
                                className={`flex-1 flex flex-col items-center px-2 py-2.5 rounded-xl border-2 text-center transition-all ${
                                  formData.rookieLogo === value
                                    ? 'border-teal-500 bg-teal-500/10 text-teal-700 dark:text-teal-400 shadow-sm'
                                    : 'border-border bg-background hover:border-muted-foreground/40 text-foreground'
                                }`}
                              >
                                <span className="font-bold text-sm">{label}</span>
                                <span className={`text-[10px] mt-0.5 ${formData.rookieLogo === value ? 'text-teal-600/70 dark:text-teal-400/70' : 'text-muted-foreground'}`}>{sub}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Auto sub-details — shown when the "Auto" attribute is selected
                        in the Card Variant / Finish section (the Attributes group). */}
                    {formData.variant.includes('Auto') && (
                      <div className="mt-3 p-4 rounded-xl border-2 border-blue-400/30 bg-blue-400/5 space-y-4 animate-in fade-in slide-in-from-top-1">
                        <p className="text-xs font-extrabold uppercase tracking-widest text-blue-700 dark:text-blue-400">Autograph Details</p>

                        {/* Signature type */}
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-foreground">Signature Type</Label>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { value: 'on_card',     label: 'On-Card',          desc: 'Hard-signed directly on the card surface' },
                              { value: 'sticker',     label: 'Sticker Auto',     desc: 'Signed sticker applied by the manufacturer' },
                              { value: 'cut',         label: 'Cut Signature',    desc: 'Historical signature cut from a document' },
                              { value: 'relic_patch', label: 'Relic & Patch',    desc: 'Auto + embedded game-used memorabilia' },
                              { value: 'in_person',   label: 'In-Person / TTM',  desc: 'Obtained directly from the player' },
                              { value: 'redemption',  label: 'Redemption Card',  desc: 'Redeemable code — signed card sent later' },
                              { value: 'book',        label: 'Book Card',        desc: 'Multi-panel card with multiple autos or swatches' },
                            ].map(({ value, label, desc }) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => set('autoType', formData.autoType === value ? '' : value)}
                                className={`flex flex-col items-start px-3 py-2.5 rounded-xl border-2 text-left transition-all ${
                                  formData.autoType === value
                                    ? 'border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-400 shadow-sm'
                                    : 'border-border bg-background hover:border-muted-foreground/40 text-foreground'
                                }`}
                              >
                                <span className="font-bold text-xs">{label}</span>
                                <span className={`text-[10px] mt-0.5 leading-tight ${formData.autoType === value ? 'text-blue-600/70 dark:text-blue-400/70' : 'text-muted-foreground'}`}>{desc}</span>
                              </button>
                            ))}
                          </div>

                          {/* Collapsible auto type guide */}
                          <div className="rounded-xl border border-blue-400/25 overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setShowAutoGuide(v => !v)}
                              className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-blue-400/5 transition-colors"
                            >
                              <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400">Not sure which type? View guide</span>
                              <ChevronDown className={`h-3.5 w-3.5 text-blue-600 dark:text-blue-400 transition-transform duration-200 ${showAutoGuide ? 'rotate-180' : ''}`} />
                            </button>
                            {showAutoGuide && (
                              <div className="px-3 pb-3 divide-y divide-border/40">
                                {[
                                  {
                                    title: 'On-Card Autograph',
                                    badge: 'Highest Value',
                                    badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20',
                                    body: 'Also known as hard-signed autos. The player signs their name directly onto the surface of the trading card. These are the most sought-after by collectors — they carry a more personal connection to the player and are visually superior to other auto types.',
                                  },
                                  {
                                    title: 'Sticker Autograph',
                                    badge: 'Common',
                                    badgeClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20',
                                    body: 'The manufacturer sends athletes large sheets of clear stickers or labels. The player signs the stickers, which are sent back to the company and applied to the finished cards. This method is highly efficient for manufacturers, but typically carries a lower collector value than on-card autos.',
                                  },
                                  {
                                    title: 'Cut Signature',
                                    badge: 'Historical',
                                    badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20',
                                    body: 'Used for historical figures, vintage athletes, or celebrities who are no longer alive or available to sign modern cards. The manufacturer cuts a signature from an old document, letter, or cheque and mounts it directly into the card.',
                                  },
                                  {
                                    title: 'Relic & Patch Auto',
                                    badge: 'Premium',
                                    badgeClass: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border border-violet-500/20',
                                    body: 'These cards feature an athlete\'s signature alongside an embedded piece of memorabilia — a game-used jersey, bat, or glove. A Patch Auto includes a multi-coloured embroidered jersey piece (often boosting value), while a Logo Patch Auto features a highly coveted league, team, or manufacturer logo.',
                                  },
                                  {
                                    title: 'In-Person / TTM Auto',
                                    badge: 'Collector Obtained',
                                    badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20',
                                    body: 'Signatures obtained directly by the collector rather than pulled from a factory pack. Collectors either meet a player at a game or signing event (In-Person) or mail a card to the player\'s team facility requesting a signature (Through The Mail). These may not include third-party authentication.',
                                  },
                                  {
                                    title: 'Redemption Card',
                                    badge: 'Pending Auto',
                                    badgeClass: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-500/20',
                                    body: 'When an athlete fails to return their signed cards before a product\'s release, the manufacturer inserts a Redemption card instead. The card contains a unique code the collector submits on the manufacturer\'s website, and the actual signed card is mailed to them at a later date.',
                                  },
                                  {
                                    title: 'Book Card',
                                    badge: 'Multi-Panel',
                                    badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20',
                                    body: 'Oversized, multi-panel cards that open like a book. They often contain multiple autographs, large jersey swatches, or a combination of several player signatures — making them some of the most visually impressive and collectible cards in any set.',
                                  },
                                ].map(({ title, badge, badgeClass, body }) => (
                                  <div key={title} className="py-2.5 first:pt-2">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-[11px] font-bold text-foreground">{title}</span>
                                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${badgeClass}`}>{badge}</span>
                                    </div>
                                    <p className="text-[10px] leading-relaxed text-muted-foreground">{body}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Number of signers */}
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-foreground">Number of Signatures</Label>
                          <div className="flex gap-2">
                            {[
                              { value: 1, label: 'Solo',   sub: '1 signature' },
                              { value: 2, label: 'Dual',   sub: '2 signatures' },
                              { value: 3, label: 'Triple', sub: '3 signatures' },
                              { value: 4, label: 'Quad',   sub: '4 signatures' },
                            ].map(({ value, label, sub }) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => set('autoSigners', value)}
                                className={`flex-1 flex flex-col items-center px-2 py-2.5 rounded-xl border-2 text-center transition-all ${
                                  formData.autoSigners === value
                                    ? 'border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-400 shadow-sm'
                                    : 'border-border bg-background hover:border-muted-foreground/40 text-foreground'
                                }`}
                              >
                                <span className="font-bold text-sm">{label}</span>
                                <span className={`text-[10px] mt-0.5 ${formData.autoSigners === value ? 'text-blue-600/70 dark:text-blue-400/70' : 'text-muted-foreground'}`}>{sub}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Patch sub-details — shown when the "Patch" attribute is selected
                        in the Card Variant / Finish section (the Attributes group). */}
                    {formData.variant.includes('Patch') && (
                      <div className="mt-3 p-4 rounded-xl border-2 border-emerald-400/30 bg-emerald-400/5 space-y-4 animate-in fade-in slide-in-from-top-1">
                        <p className="text-xs font-extrabold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Patch Details</p>

                        {/* Patch type */}
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-foreground">Patch Type</Label>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { value: 'game_used',    label: 'Game-Used',          desc: 'Swatch from a jersey or gear worn in an official game' },
                              { value: 'player_worn',  label: 'Player-Worn',        desc: 'Worn by the player off-field, not during a game' },
                              { value: 'event_worn',   label: 'Event-Worn',         desc: 'Worn at a league event like the Rookie Premiere' },
                              { value: 'rookie_patch', label: 'Rookie Patch Auto',  desc: 'Rookie card pairing a patch with an autograph (RPA)' },
                              { value: 'prime',        label: 'Prime / Multi-Colour', desc: 'Premium patch showing logos, stripes or seams' },
                              { value: 'laundry_tag',  label: 'Laundry Tag',        desc: 'Care tag cut from the jersey — usually a 1/1' },
                              { value: 'nameplate',    label: 'Nameplate Letter',   desc: "A letter cut from the player's jersey nameplate" },
                              { value: 'manufactured', label: 'Manufactured',       desc: 'Made by the manufacturer — never actually worn' },
                            ].map(({ value, label, desc }) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => set('patchType', formData.patchType === value ? '' : value)}
                                className={`flex flex-col items-start px-3 py-2.5 rounded-xl border-2 text-left transition-all ${
                                  formData.patchType === value
                                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 shadow-sm'
                                    : 'border-border bg-background hover:border-muted-foreground/40 text-foreground'
                                }`}
                              >
                                <span className="font-bold text-xs">{label}</span>
                                <span className={`text-[10px] mt-0.5 leading-tight ${formData.patchType === value ? 'text-emerald-600/70 dark:text-emerald-400/70' : 'text-muted-foreground'}`}>{desc}</span>
                              </button>
                            ))}
                          </div>

                          {/* Collapsible patch type guide */}
                          <div className="rounded-xl border border-emerald-400/25 overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setShowPatchGuide(v => !v)}
                              className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-emerald-400/5 transition-colors"
                            >
                              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">Not sure which type? View guide</span>
                              <ChevronDown className={`h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 transition-transform duration-200 ${showPatchGuide ? 'rotate-180' : ''}`} />
                            </button>
                            {showPatchGuide && (
                              <div className="px-3 pb-3 divide-y divide-border/40">
                                {[
                                  {
                                    title: 'Game-Used Memorabilia',
                                    badge: 'Authentic',
                                    badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20',
                                    body: 'A swatch cut from a jersey, glove, base, or other equipment actually worn or used by the player during an official game. Plain single-colour swatches are common, while multi-colour pieces showing seams or stripes command a premium.',
                                  },
                                  {
                                    title: 'Player-Worn',
                                    badge: 'Common',
                                    badgeClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20',
                                    body: 'Material worn by the player but not during a game — typically at a photo shoot or promotional appearance. Authentic to the player, but generally valued lower than true game-used pieces.',
                                  },
                                  {
                                    title: 'Event-Worn',
                                    badge: 'Premium',
                                    badgeClass: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border border-violet-500/20',
                                    body: 'Worn at a specific league event such as the Rookie Premiere, Combine, or All-Star festivities. These jerseys are the source of many sought-after rookie patch cards.',
                                  },
                                  {
                                    title: 'Rookie Patch Auto (RPA)',
                                    badge: 'Grail',
                                    badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20',
                                    body: "A rookie card that combines a memorabilia patch with the player's autograph. RPAs are among the most coveted and valuable modern cards, especially when serial-numbered or featuring a multi-colour prime patch.",
                                  },
                                  {
                                    title: 'Prime Patch',
                                    badge: 'High Value',
                                    badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20',
                                    body: 'A patch piece containing premium detail — team logos, jersey numbers, stripes, or seams — rather than a plain single colour. Prime patches are far rarer and significantly more valuable than standard swatches.',
                                  },
                                  {
                                    title: 'Laundry Tag',
                                    badge: '1/1',
                                    badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20',
                                    body: 'The small care/wash tag sewn into a jersey. Because each jersey has only one, laundry-tag cards are typically unique 1/1s and are extremely rare and desirable.',
                                  },
                                  {
                                    title: 'Nameplate Letter',
                                    badge: 'Rare',
                                    badgeClass: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-500/20',
                                    body: "A single letter cut from the player's jersey nameplate. The number of available cards is limited by the letters in the player's name, making these scarce and collectible.",
                                  },
                                  {
                                    title: 'Manufactured / Commemorative',
                                    badge: 'Decorative',
                                    badgeClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20',
                                    body: 'A patch created by the manufacturer — such as a commemorative logo, sleeve badge, or team crest — that was never actually worn. Visually striking but generally lower in collector value than worn memorabilia.',
                                  },
                                ].map(({ title, badge, badgeClass, body }) => (
                                  <div key={title} className="py-2.5 first:pt-2">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-[11px] font-bold text-foreground">{title}</span>
                                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${badgeClass}`}>{badge}</span>
                                    </div>
                                    <p className="text-[10px] leading-relaxed text-muted-foreground">{body}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Number of memorabilia pieces */}
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-foreground">Memorabilia Pieces</Label>
                          <div className="flex gap-2">
                            {[
                              { value: 1, label: 'Single', sub: '1 swatch' },
                              { value: 2, label: 'Dual',   sub: '2 swatches' },
                              { value: 3, label: 'Triple', sub: '3 swatches' },
                              { value: 4, label: 'Quad',   sub: '4+ swatches' },
                            ].map(({ value, label, sub }) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => set('patchPieces', value)}
                                className={`flex-1 flex flex-col items-center px-2 py-2.5 rounded-xl border-2 text-center transition-all ${
                                  formData.patchPieces === value
                                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 shadow-sm'
                                    : 'border-border bg-background hover:border-muted-foreground/40 text-foreground'
                                }`}
                              >
                                <span className="font-bold text-sm">{label}</span>
                                <span className={`text-[10px] mt-0.5 ${formData.patchPieces === value ? 'text-emerald-600/70 dark:text-emerald-400/70' : 'text-muted-foreground'}`}>{sub}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Relic sub-details — shown when the "Relic / Jersey" attribute is
                        selected in the Card Variant / Finish section (Attributes group). */}
                    {formData.variant.includes('Relic / Jersey') && (
                      <div className="mt-3 p-4 rounded-xl border-2 border-amber-400/30 bg-amber-400/5 space-y-4 animate-in fade-in slide-in-from-top-1">
                        <p className="text-xs font-extrabold uppercase tracking-widest text-amber-700 dark:text-amber-400">Relic Details</p>

                        {/* Relic material */}
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-foreground">Relic Material</Label>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { value: 'jersey',  label: 'Jersey / Swatch', desc: 'Single-colour fabric swatch from a uniform' },
                              { value: 'bat',     label: 'Bat',             desc: 'A piece of wood from a game-used bat' },
                              { value: 'ball',    label: 'Ball',            desc: 'Leather from a game-used ball' },
                              { value: 'glove',   label: 'Glove',           desc: 'Material from a fielding glove or mitt' },
                              { value: 'cleat',   label: 'Cleat / Shoe',    desc: 'A piece of a game-worn cleat or shoe' },
                              { value: 'base',    label: 'Base',            desc: 'A swatch from a game-used base' },
                              { value: 'cap',     label: 'Cap / Hat',       desc: "Fabric from a player's cap or helmet" },
                              { value: 'pylon',   label: 'Pylon',           desc: 'A piece of a game-used end-zone pylon' },
                              { value: 'net',     label: 'Net',             desc: 'A strand from a game-used basketball net' },
                              { value: 'stadium', label: 'Stadium / Seat',  desc: 'Material from the ballpark or arena' },
                              { value: 'dirt',    label: 'Dirt / Soil',     desc: 'Playing-surface dirt from a specific venue' },
                              { value: 'other',   label: 'Other',           desc: 'Another type of game-used material' },
                            ].map(({ value, label, desc }) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => set('relicMaterial', formData.relicMaterial === value ? '' : value)}
                                className={`flex flex-col items-start px-3 py-2.5 rounded-xl border-2 text-left transition-all ${
                                  formData.relicMaterial === value
                                    ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400 shadow-sm'
                                    : 'border-border bg-background hover:border-muted-foreground/40 text-foreground'
                                }`}
                              >
                                <span className="font-bold text-xs">{label}</span>
                                <span className={`text-[10px] mt-0.5 leading-tight ${formData.relicMaterial === value ? 'text-amber-600/70 dark:text-amber-400/70' : 'text-muted-foreground'}`}>{desc}</span>
                              </button>
                            ))}
                          </div>

                          {/* Collapsible relic guide */}
                          <div className="rounded-xl border border-amber-400/25 overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setShowRelicGuide(v => !v)}
                              className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-amber-400/5 transition-colors"
                            >
                              <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">Not sure? View relic guide</span>
                              <ChevronDown className={`h-3.5 w-3.5 text-amber-600 dark:text-amber-400 transition-transform duration-200 ${showRelicGuide ? 'rotate-180' : ''}`} />
                            </button>
                            {showRelicGuide && (
                              <div className="px-3 pb-3 divide-y divide-border/40">
                                {[
                                  {
                                    title: 'Jersey / Swatch',
                                    badge: 'Common',
                                    badgeClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20',
                                    body: 'A swatch of fabric from a uniform — the most common relic. Plain single-colour swatches are standard; multi-colour pieces with logos, numbers, or seams are classified as Patches and carry far higher value.',
                                  },
                                  {
                                    title: 'Bat',
                                    badge: 'Popular',
                                    badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20',
                                    body: 'A fragment of wood from a game-used bat. Highly popular for its direct connection to the player at the plate. Nameplate or barrel pieces are the most desirable.',
                                  },
                                  {
                                    title: 'Ball & Base',
                                    badge: 'Premium',
                                    badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20',
                                    body: 'Leather from a game-used ball or a swatch from a base. Often tied to a specific game or milestone, which can add a meaningful provenance premium.',
                                  },
                                  {
                                    title: 'Glove, Cleat & Cap',
                                    badge: 'Less Common',
                                    badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20',
                                    body: 'Material from a glove, cleat/shoe, or cap. Less frequently produced than jersey swatches, which can make them a unique and collectible addition.',
                                  },
                                  {
                                    title: 'Stadium, Dirt & Unusual',
                                    badge: 'Novelty',
                                    badgeClass: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border border-violet-500/20',
                                    body: 'Pieces of the playing surface, seats, pylons, nets, or even venue dirt. These novelty relics connect the card to a place or event rather than directly to the player.',
                                  },
                                  {
                                    title: 'Game-Used vs Player-Worn',
                                    badge: 'Value Driver',
                                    badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20',
                                    body: 'Always check the card back. Game-Used material saw action in an official game and commands the highest premium. Player-Worn was worn off-field (e.g. a photo shoot) and is worth less. Event-Used comes from a specific event, while Manufactured pieces were never worn at all.',
                                  },
                                ].map(({ title, badge, badgeClass, body }) => (
                                  <div key={title} className="py-2.5 first:pt-2">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-[11px] font-bold text-foreground">{title}</span>
                                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${badgeClass}`}>{badge}</span>
                                    </div>
                                    <p className="text-[10px] leading-relaxed text-muted-foreground">{body}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Relic source / authenticity */}
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-foreground">Source</Label>
                          <div className="flex gap-2">
                            {[
                              { value: 'game_used',    label: 'Game-Used',    sub: 'Used in a game' },
                              { value: 'player_worn',  label: 'Player-Worn',  sub: 'Worn off-field' },
                              { value: 'event_used',   label: 'Event-Used',   sub: 'From an event' },
                              { value: 'manufactured', label: 'Manufactured', sub: 'Never worn' },
                            ].map(({ value, label, sub }) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => set('relicSource', formData.relicSource === value ? '' : value)}
                                className={`flex-1 flex flex-col items-center px-2 py-2.5 rounded-xl border-2 text-center transition-all ${
                                  formData.relicSource === value
                                    ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400 shadow-sm'
                                    : 'border-border bg-background hover:border-muted-foreground/40 text-foreground'
                                }`}
                              >
                                <span className="font-bold text-sm">{label}</span>
                                <span className={`text-[10px] mt-0.5 ${formData.relicSource === value ? 'text-amber-600/70 dark:text-amber-400/70' : 'text-muted-foreground'}`}>{sub}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Numbering sub-details — shown when the "Numbered" attribute is
                        selected in the Card Variant / Finish section (Attributes group). */}
                    {formData.variant.includes('Numbered') && (
                      <div className="mt-3 p-4 rounded-xl border-2 border-violet-400/30 bg-violet-400/5 space-y-4 animate-in fade-in slide-in-from-top-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-extrabold uppercase tracking-widest text-violet-700 dark:text-violet-400">Numbering Details</p>
                          {formData.serialPrintRun === '1' && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-700 dark:text-violet-400 border border-violet-500/30">
                              ★ One-of-One (1/1)
                            </span>
                          )}
                        </div>

                        {/* Serial number — position / print run */}
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-foreground">Serial Number</Label>
                          <div className="flex items-end gap-2">
                            <div className="flex-1 space-y-1">
                              <span className="text-[10px] text-muted-foreground font-medium">Card #</span>
                              <Input
                                type="number"
                                min={1}
                                inputMode="numeric"
                                placeholder="e.g. 23"
                                value={formData.serialPosition}
                                onChange={e => {
                                  const v = e.target.value;
                                  setFormData(f => ({
                                    ...f,
                                    serialPosition: v,
                                    serialNumber: v && f.serialPrintRun ? `${v}/${f.serialPrintRun}` : f.serialNumber,
                                  }));
                                }}
                                className="h-10 bg-background text-center"
                              />
                            </div>
                            <span className="pb-2.5 text-lg font-bold text-muted-foreground">/</span>
                            <div className="flex-1 space-y-1">
                              <span className="text-[10px] text-muted-foreground font-medium">Print run</span>
                              <Input
                                type="number"
                                min={1}
                                inputMode="numeric"
                                placeholder="e.g. 99"
                                value={formData.serialPrintRun}
                                onChange={e => {
                                  const v = e.target.value;
                                  setFormData(f => ({
                                    ...f,
                                    serialPrintRun: v,
                                    serialNumber: f.serialPosition && v ? `${f.serialPosition}/${v}` : f.serialNumber,
                                  }));
                                }}
                                className="h-10 bg-background text-center"
                              />
                            </div>
                          </div>

                          {/* Quick-pick common print runs */}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {[1, 5, 10, 25, 50, 75, 99, 150, 199, 299].map(run => {
                              const active = formData.serialPrintRun === String(run);
                              return (
                                <button
                                  key={run}
                                  type="button"
                                  onClick={() => setFormData(f => ({
                                    ...f,
                                    serialPrintRun: String(run),
                                    serialNumber: f.serialPosition ? `${f.serialPosition}/${run}` : f.serialNumber,
                                  }))}
                                  className={`px-2.5 py-1 rounded-full border text-[11px] font-bold transition-all ${
                                    active
                                      ? 'border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-400 shadow-sm'
                                      : 'border-border bg-background text-foreground hover:border-muted-foreground/40'
                                  }`}
                                >
                                  {run === 1 ? '1/1' : `/${run}`}
                                </button>
                              );
                            })}
                          </div>

                          <p className="text-[10px] text-muted-foreground leading-relaxed">
                            Tip: if the card number matches the player's jersey number (e.g. 27/99 for a #27 player),
                            it's a <span className="font-semibold text-foreground">jersey-number card</span> and usually sells at a premium.
                          </p>

                          {/* Collapsible numbering guide */}
                          <div className="rounded-xl border border-violet-400/25 overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setShowNumberGuide(v => !v)}
                              className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-violet-400/5 transition-colors"
                            >
                              <span className="text-[11px] font-bold text-violet-700 dark:text-violet-400">How does numbering work? View guide</span>
                              <ChevronDown className={`h-3.5 w-3.5 text-violet-600 dark:text-violet-400 transition-transform duration-200 ${showNumberGuide ? 'rotate-180' : ''}`} />
                            </button>
                            {showNumberGuide && (
                              <div className="px-3 pb-3 divide-y divide-border/40">
                                {[
                                  {
                                    title: 'Reading a Serial Number',
                                    badge: 'Basics',
                                    badgeClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20',
                                    body: 'Stamped as 23/99: the second number is the total print run (only 99 copies exist in the world), and the first is this specific copy. The smaller the print run, the rarer the card.',
                                  },
                                  {
                                    title: 'One-of-One (1/1)',
                                    badge: 'Rarest',
                                    badgeClass: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border border-violet-500/20',
                                    body: 'Only a single copy exists. 1/1s are the most coveted parallels in the hobby and can command enormous premiums — often many times the value of any other version of the card.',
                                  },
                                  {
                                    title: 'Jersey-Number Card',
                                    badge: 'Premium',
                                    badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20',
                                    body: "When the card number matches the player's jersey number (e.g. 27/99 for a player who wears #27), collectors typically pay a 20–50% premium over other copies in the same run.",
                                  },
                                  {
                                    title: 'Print Run & Value',
                                    badge: 'Rarity',
                                    badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20',
                                    body: 'Value rises sharply as the run shrinks. Coloured parallels are often tiered — e.g. /299, /199, /99, /25, /10, down to a 1/1 — with each lower tier significantly scarcer and more valuable.',
                                  },
                                  {
                                    title: 'First Off The Line (FOTL)',
                                    badge: 'Special',
                                    badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20',
                                    body: 'Some products release a small allotment early as "First Off The Line". These FOTL copies — and low positions like the first card printed — can carry extra collector cachet.',
                                  },
                                ].map(({ title, badge, badgeClass, body }) => (
                                  <div key={title} className="py-2.5 first:pt-2">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-[11px] font-bold text-foreground">{title}</span>
                                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${badgeClass}`}>{badge}</span>
                                    </div>
                                    <p className="text-[10px] leading-relaxed text-muted-foreground">{body}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Short-print sub-details — shown when the "Short Print (SP)" attribute
                        is selected in the Card Variant / Finish section (Attributes group). */}
                    {formData.variant.includes('Short Print (SP)') && (
                      <div className="mt-3 p-4 rounded-xl border-2 border-rose-400/30 bg-rose-400/5 space-y-4 animate-in fade-in slide-in-from-top-1">
                        <p className="text-xs font-extrabold uppercase tracking-widest text-rose-700 dark:text-rose-400">Short Print Details</p>

                        {/* Variation type */}
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-foreground">Variation Type</Label>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { value: 'photo',       label: 'Photo Variation',  desc: 'A completely different photo from the base card' },
                              { value: 'image',       label: 'Image Variation',  desc: 'Alternate crop or background of the same shot' },
                              { value: 'jersey',      label: 'Jersey / Colour',  desc: 'Different uniform or colour from the base' },
                              { value: 'throwback',   label: 'Throwback',        desc: 'Retro or alternate-era uniform' },
                              { value: 'celebration', label: 'Celebration',      desc: 'Candid or celebration moment' },
                              { value: 'nickname',    label: 'Nickname / Name',  desc: 'Nickname instead of the given name' },
                              { value: 'logo',        label: 'Logo / Mascot',    desc: 'Team logo or mascot variation' },
                              { value: 'sp_base',     label: 'Short-Printed Base', desc: 'Same design, simply printed in lower quantity' },
                              { value: 'other',       label: 'Other',            desc: 'Another short-print variation' },
                            ].map(({ value, label, desc }) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => set('spVariation', formData.spVariation === value ? '' : value)}
                                className={`flex flex-col items-start px-3 py-2.5 rounded-xl border-2 text-left transition-all ${
                                  formData.spVariation === value
                                    ? 'border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-400 shadow-sm'
                                    : 'border-border bg-background hover:border-muted-foreground/40 text-foreground'
                                }`}
                              >
                                <span className="font-bold text-xs">{label}</span>
                                <span className={`text-[10px] mt-0.5 leading-tight ${formData.spVariation === value ? 'text-rose-600/70 dark:text-rose-400/70' : 'text-muted-foreground'}`}>{desc}</span>
                              </button>
                            ))}
                          </div>

                          {/* Collapsible short-print guide */}
                          <div className="rounded-xl border border-rose-400/25 overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setShowSpGuide(v => !v)}
                              className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-rose-400/5 transition-colors"
                            >
                              <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400">What is a short print? View guide</span>
                              <ChevronDown className={`h-3.5 w-3.5 text-rose-600 dark:text-rose-400 transition-transform duration-200 ${showSpGuide ? 'rotate-180' : ''}`} />
                            </button>
                            {showSpGuide && (
                              <div className="px-3 pb-3 divide-y divide-border/40">
                                {[
                                  {
                                    title: 'Short Print (SP)',
                                    badge: 'Scarce',
                                    badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20',
                                    body: 'A card deliberately printed in lower quantities than the standard base cards in the set. SPs are harder to pull and carry a premium, even when they are not serial-numbered.',
                                  },
                                  {
                                    title: 'Super Short Print (SSP)',
                                    badge: 'Very Rare',
                                    badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20',
                                    body: 'Rarer still than an SP — typically fewer than ~100 copies produced. SSPs are among the toughest non-numbered cards to find and are highly sought after.',
                                  },
                                  {
                                    title: 'Photo / Image Variation',
                                    badge: 'Collector Favourite',
                                    badgeClass: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border border-violet-500/20',
                                    body: 'Unlike parallels (same image, different finish), short-print variations use a completely different photo — a candid dugout shot, a celebration, an alternate jersey, or a nickname nameplate.',
                                  },
                                  {
                                    title: 'How to Identify One',
                                    badge: 'How To',
                                    badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20',
                                    body: 'Turn the card over and check the small code on the back — the last few digits often reveal whether a card is a base, SP, or SSP. Comparing the front photo to the known base card also helps.',
                                  },
                                  {
                                    title: 'Scarcity Hierarchy',
                                    badge: 'Rarity',
                                    badgeClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20',
                                    body: 'From most common to rarest: Base → SP → SSP → Ultra / Case Hit. The scarcer the tier, the stronger the premium over the base card.',
                                  },
                                ].map(({ title, badge, badgeClass, body }) => (
                                  <div key={title} className="py-2.5 first:pt-2">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-[11px] font-bold text-foreground">{title}</span>
                                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${badgeClass}`}>{badge}</span>
                                    </div>
                                    <p className="text-[10px] leading-relaxed text-muted-foreground">{body}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Scarcity tier */}
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-foreground">Scarcity Tier</Label>
                          <div className="flex gap-2">
                            {[
                              { value: 'sp',    label: 'SP',    sub: 'Short Print' },
                              { value: 'ssp',   label: 'SSP',   sub: 'Super Short Print' },
                              { value: 'ultra', label: 'Ultra', sub: 'Case Hit' },
                            ].map(({ value, label, sub }) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => set('spTier', formData.spTier === value ? '' : value)}
                                className={`flex-1 flex flex-col items-center px-2 py-2.5 rounded-xl border-2 text-center transition-all ${
                                  formData.spTier === value
                                    ? 'border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-400 shadow-sm'
                                    : 'border-border bg-background hover:border-muted-foreground/40 text-foreground'
                                }`}
                              >
                                <span className="font-bold text-sm">{label}</span>
                                <span className={`text-[10px] mt-0.5 ${formData.spTier === value ? 'text-rose-600/70 dark:text-rose-400/70' : 'text-muted-foreground'}`}>{sub}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </SectionCard>

              {/* ── 2. Grading ── */}
              <SectionCard title="Grading">
                <div className="space-y-4">
                  <div>
                    <Label className="font-bold mb-3 block">Grading Service</Label>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                      {GRADING_COMPANIES.map(({ value, label, sub, activeClass }) => {
                        const isActive = formData.gradingCompany === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => set('gradingCompany', value)}
                            className={`flex flex-col items-center px-2 py-2.5 rounded-xl border-2 text-center transition-all duration-150 ${
                              isActive ? `${activeClass} shadow-sm` : 'border-border bg-background hover:border-muted-foreground/40 text-foreground'
                            }`}
                          >
                            <span className="font-extrabold text-sm leading-tight">{label}</span>
                            <span className={`text-[9px] mt-0.5 leading-tight ${isActive ? 'opacity-70' : 'text-muted-foreground'}`}>{sub}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {isGraded && (
                    <div className="grid md:grid-cols-2 gap-4 pt-2 border-t border-border animate-in fade-in slide-in-from-top-1">
                      {/* Grade */}
                      <div className="space-y-2">
                        <Label className="font-bold flex items-center gap-1.5">
                          <Award className="w-4 h-4 text-amber-500" /> Grade Score
                        </Label>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {COMMON_GRADES.map(g => (
                            <button
                              key={g}
                              type="button"
                              onClick={() => set('grade', g)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                                formData.grade === g
                                  ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
                                  : 'border-border bg-background hover:border-amber-400 hover:text-amber-600'
                              }`}
                            >
                              {g}
                            </button>
                          ))}
                        </div>
                        <Input
                          value={formData.grade}
                          onChange={e => set('grade', e.target.value)}
                          placeholder="e.g. 9.5 or Authentic"
                          className={`h-11 bg-background ${isAutoFilled && formData.grade ? 'border-primary/50 ring-1 ring-primary/20' : ''}`}
                        />
                      </div>

                      {/* Cert Number */}
                      <div className="space-y-2">
                        <Label htmlFor="certNumber" className="font-bold flex items-center gap-1.5">
                          <Star className="w-4 h-4 text-amber-500" /> Cert / Population Number
                        </Label>
                        <Input
                          id="certNumber"
                          value={formData.certNumber}
                          onChange={e => set('certNumber', e.target.value)}
                          placeholder="e.g. 12345678"
                          className="h-11 bg-background"
                        />
                        <p className="text-xs text-muted-foreground">Verify at {formData.gradingCompany.toUpperCase()}'s website</p>
                      </div>
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* PSA population panel — only shown when we have a CardSight match */}
              {isEdit && (
                <div className="premium-card p-6 bg-card space-y-3">
                  <h2 className="font-serif text-xl font-bold border-b border-border pb-3">PSA Population</h2>
                  <PSAPopPanel rawData={psaPopData} />
                </div>
              )}

              {/* ── 3. Value & Acquisition ── */}
              <SectionCard title="Value & Acquisition">
                {/* Locked base value banner (edit mode only) */}
                {isEdit && lockedBaseValue !== null && (
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 -mt-1">
                    <Shield className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-amber-700">Locked Base Value: ${lockedBaseValue.toFixed(2)} AUD</p>
                      <p className="text-xs text-amber-600/80 mt-0.5">
                        Your listing price and trade value cannot be set below this floor. It protects platform commission from being bypassed.
                        Contact support to dispute the valuation.
                      </p>
                    </div>
                  </div>
                )}

                {/* New card notice */}
                {!isEdit && (
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 -mt-1">
                    <Shield className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-blue-700">
                      The estimated value you enter will be locked as this card&apos;s <strong>base valuation</strong>. You cannot list or trade the card for less than this amount later.
                      Use the eBay market data above to set an accurate figure.
                    </p>
                  </div>
                )}

                {/* eBay market price suggestion */}
                {(isLookingUp || priceData) && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    {isLookingUp ? (
                      <p className="text-xs font-medium text-emerald-700 flex items-center gap-2">
                        <Loader2 className="w-3 h-3 animate-spin" /> Looking up eBay market price…
                      </p>
                    ) : priceData && (
                      <>
                        <p className="text-xs font-bold text-emerald-700 flex items-center gap-1.5 mb-2">
                          <TrendingUp className="w-3.5 h-3.5" /> eBay AU Market Data ({priceData.count} recent sales)
                        </p>
                        <div className="flex gap-3 text-xs text-emerald-800 mb-3">
                          <span>Avg: <strong>${priceData.avgPrice?.toFixed(2)}</strong></span>
                          <span>Low: <strong>${priceData.minPrice?.toFixed(2)}</strong></span>
                          <span>High: <strong>${priceData.maxPrice?.toFixed(2)}</strong></span>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-emerald-400 text-emerald-700 hover:bg-emerald-50"
                          onClick={() => {
                            set('estimatedValue', String(priceData.avgPrice?.toFixed(2) ?? ''));
                            clearPrice();
                            toast.success(`Estimated value set to $${priceData.avgPrice?.toFixed(2)} AUD from eBay data.`);
                          }}
                        >
                          Use eBay average (${priceData.avgPrice?.toFixed(2)})
                        </Button>
                      </>
                    )}
                  </div>
                )}

                {/* CardSight market price */}
                {(isLoadingCsPrice || csPrice) && (
                  <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                    {isLoadingCsPrice ? (
                      <p className="text-xs font-medium text-blue-700 dark:text-blue-400 flex items-center gap-2">
                        <Loader2 className="w-3 h-3 animate-spin" /> Fetching CardSight pricing…
                      </p>
                    ) : csPrice && (() => {
                      const avg = csPrice.avg_price ?? csPrice.average_price ?? csPrice.mean_price;
                      const min = csPrice.min_price ?? csPrice.minimum_price;
                      const max = csPrice.max_price ?? csPrice.maximum_price;
                      const count = csPrice.count ?? csPrice.total_count ?? csPrice.total;
                      if (!avg) return null;
                      return (
                        <>
                          <p className="text-xs font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1.5 mb-2">
                            <Shield className="w-3.5 h-3.5" /> CardSight Market Data{count ? ` (${count} sales)` : ''}
                          </p>
                          <div className="flex gap-3 text-xs text-blue-800 dark:text-blue-300 mb-3">
                            <span>Avg: <strong>${Number(avg).toFixed(2)}</strong></span>
                            {min != null && <span>Low: <strong>${Number(min).toFixed(2)}</strong></span>}
                            {max != null && <span>High: <strong>${Number(max).toFixed(2)}</strong></span>}
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-blue-400 text-blue-700 hover:bg-blue-50 dark:text-blue-400"
                            onClick={() => {
                              set('estimatedValue', String(Number(avg).toFixed(2)));
                              clearCsPrice();
                              toast.success(`Estimated value set to $${Number(avg).toFixed(2)} AUD from CardSight data.`);
                            }}
                          >
                            Use CardSight average (${Number(avg).toFixed(2)})
                          </Button>
                        </>
                      );
                    })()}
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="estimatedValue" className="font-bold">
                      Estimated Value (AUD) <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                      <Input
                        id="estimatedValue"
                        type="number"
                        min={isEdit && lockedBaseValue !== null ? lockedBaseValue : 0}
                        step="0.01"
                        value={formData.estimatedValue}
                        onChange={e => set('estimatedValue', e.target.value)}
                        placeholder="0.00"
                        className={`h-11 pl-8 bg-background tabular-nums ${isAutoFilled ? 'border-primary/50 ring-1 ring-primary/20' : ''} ${errors.estimatedValue ? 'border-destructive' : ''}`}
                      />
                    </div>
                    {errors.estimatedValue && <p className="text-destructive text-xs">{errors.estimatedValue}</p>}
                    <p className="text-xs text-muted-foreground">
                      {isEdit && lockedBaseValue !== null
                        ? `Floor: $${lockedBaseValue.toFixed(2)} — cannot go below this`
                        : 'Your estimate of current market value — will be locked on save'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="purchasePrice" className="font-bold">Purchase Price (AUD)</Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                      <Input
                        id="purchasePrice"
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.purchasePrice}
                        onChange={e => set('purchasePrice', e.target.value)}
                        placeholder="0.00"
                        className="h-11 pl-8 bg-background tabular-nums"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">What you paid — for your own tracking</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="acquiredDate" className="font-bold">Date Acquired</Label>
                    <Input
                      id="acquiredDate"
                      type="date"
                      value={formData.acquiredDate}
                      onChange={e => set('acquiredDate', e.target.value)}
                      className="h-11 bg-background"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="acquiredFrom" className="font-bold">Acquired From</Label>
                    <Input
                      id="acquiredFrom"
                      value={formData.acquiredFrom}
                      onChange={e => set('acquiredFrom', e.target.value)}
                      placeholder="e.g. eBay, Local shop, Trade"
                      className="h-11 bg-background"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="notes" className="font-bold">Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={e => set('notes', e.target.value)}
                      placeholder="Any specific details about this card's condition, history, or unique features…"
                      rows={3}
                      className={`resize-none bg-background ${isAutoFilled ? 'border-primary/50 ring-1 ring-primary/20' : ''}`}
                    />
                  </div>
                </div>
              </SectionCard>

              {/* ── 4. Listing Visibility ── */}
              <SectionCard title="Listing Visibility">
                <p className="text-sm text-muted-foreground -mt-2">Choose how this card appears to other collectors.</p>

                <div className="grid grid-cols-2 gap-3">
                  {LISTING_OPTIONS.map(({ value, label, description, Icon, activeClass, iconClass }) => {
                    const isActive = formData.listingType === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => set('listingType', value)}
                        className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                          isActive
                            ? `${activeClass} shadow-sm`
                            : 'border-border bg-background hover:border-muted-foreground/40 hover:bg-muted/30 text-foreground'
                        }`}
                      >
                        <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${isActive ? iconClass : 'text-muted-foreground'}`} />
                        <div>
                          <p className="font-bold text-sm leading-tight">{label}</p>
                          <p className={`text-xs mt-0.5 ${isActive ? 'opacity-80' : 'text-muted-foreground'}`}>{description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {(formData.listingType === 'For Sale' || formData.listingType === 'For Sale & Trade') && (
                  <div className="space-y-2 pt-3 border-t border-border">
                    <Label htmlFor="listingPrice" className="font-bold flex items-center gap-1.5">
                      <ShoppingCart className="w-4 h-4 text-emerald-500" /> Asking Price (AUD)
                    </Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                      <input
                        id="listingPrice"
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.estimatedValue}
                        onChange={e => set('estimatedValue', e.target.value)}
                        placeholder="0.00"
                        className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm pl-8 tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                  </div>
                )}

                {(formData.listingType === 'For Trade' || formData.listingType === 'For Sale & Trade') && (
                  <div className="space-y-2 pt-3 border-t border-border">
                    <Label htmlFor="tradeValueInput" className="font-bold flex items-center gap-1.5">
                      <ArrowRightLeft className="w-4 h-4 text-violet-500" /> Trade Value (AUD)
                    </Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                      <input
                        id="tradeValueInput"
                        type="number"
                        min={isEdit && lockedBaseValue !== null ? lockedBaseValue : 0}
                        step="0.01"
                        value={formData.tradeValue}
                        onChange={e => set('tradeValue', e.target.value)}
                        placeholder="0.00"
                        className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm pl-8 tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {isEdit && lockedBaseValue !== null
                        ? `Floor: $${lockedBaseValue.toFixed(2)} — the value in traded cards you'd accept`
                        : "The value in traded cards you'd accept"}
                    </p>
                  </div>
                )}
              </SectionCard>

            </div>
          </div>

          <div className="flex justify-end gap-4 pt-6 border-t border-border">
            <Button type="button" variant="outline" className="h-14 px-8 text-lg" asChild>
              <Link to="/vault">Cancel</Link>
            </Button>
            <Button type="submit" disabled={saving} className="h-14 px-10 font-bold text-lg shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
              {saving
                ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Saving...</>
                : <><Save className="w-5 h-5 mr-2" /> {isEdit ? 'Update Card' : 'Save Card'}</>
              }
            </Button>
          </div>
        </form>
      </div>

      {/* Photo Template Modal */}
      <PhotoTemplateModal
        isOpen={photoTemplateModal.open}
        onClose={closePhotoTemplateModal}
        onConfirm={handleConfirmTemplate}
        isProcessing={isPhotoProcessing || isUploadingTemplate}
        previewUrl={previewUrl}
        processType={photoTemplateModal.processType}
        step={photoTemplateModal.step}
      />
    </div>
  );
};

export default AddEditCardPage;
