import React, { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Camera, Upload, ScanLine, ShieldCheck, RefreshCw, Plus, LogIn,
  Sparkles, TrendingUp, BadgeCheck,
} from 'lucide-react';
import SEOHead from '@/components/SEOHead.jsx';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useCardOCR } from '@/hooks/useCardOCR.js';
import { useCardSight } from '@/hooks/useCardSight.js';
import { useEbayPriceLookup } from '@/hooks/useEbayPriceLookup.js';
import { prepareAnalysisImages } from '@/utils/analysisImage.js';

// The camera overlay pulls the OpenCV loader with it — keep it off this page's
// initial chunk; it only loads when the visitor taps "Use camera".
const CardScanCamera = lazy(() => import('@/components/CardScanCamera.jsx'));

const PHASE_LABELS = {
  prepare: 'Preparing your photo…',
  read: 'Reading the card…',
  match: 'Matching against the catalog…',
  price: 'Checking live prices…',
};

const aud = (n) => `$${Number(n).toFixed(2)}`;

// Standalone price checker: photo → identification → live pricing, with a
// straight path into listing the card. Same pipeline as the Add Card wizard
// (docs/card-identification.md) minus the 40-field form around it. The page is
// public; running a scan needs an account because the OCR and CardSight
// endpoints behind it are authenticated (each scan is a paid model call).
const ScanPage = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [phase, setPhase] = useState(null); // null | prepare | read | match | price
  const [scan, setScan] = useState(null);   // { ocr, cardSight, ebay }

  const { scanCard } = useCardOCR();
  const { identify } = useCardSight();
  const { lookupPrice } = useEbayPriceLookup();

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const acceptPhoto = (nextFile) => {
    if (!nextFile) return;
    setScan(null);
    setFile(nextFile);
    setPreviewUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(nextFile);
    });
  };

  const handleScan = async () => {
    if (!file || phase) return;
    setScan(null);
    try {
      setPhase('prepare');
      const { files } = await prepareAnalysisImages([file]);
      const analysisImage = files[0] ?? file;

      // OCR first — it names the category, which narrows CardSight to a
      // single segment (the order is load-bearing, see the identification doc).
      setPhase('read');
      const ocr = await scanCard(analysisImage);

      setPhase('match');
      const cardSight = await identify(analysisImage, ocr?.collectionType || '');

      setPhase('price');
      const identity = ocr?.name
        ? ocr
        : cardSight?.identified && cardSight.card?.name
          ? { name: cardSight.card.name, cardSetName: cardSight.card.setName }
          : null;
      const ebay = identity ? await lookupPrice(identity) : null;

      setScan({ ocr: ocr ?? null, cardSight: cardSight ?? null, ebay });
    } finally {
      setPhase(null);
    }
  };

  const reset = () => {
    setScan(null);
    setFile(null);
    setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
  };

  const ocr = scan?.ocr;
  const cs = scan?.cardSight;
  const ebay = scan?.ebay;
  const identified = ocr?.name || (cs?.identified && cs.card?.name);
  const graded = ocr?.gradingService && ocr.gradingService !== 'None';

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Card Scanner — Free Price Check | CardPop Australia™"
        description="Scan any trading card or graded slab with your camera and get an instant identification and live AUD price check. Pokémon, sports cards, TCGs — free with a CardPop account."
        canonicalUrl="https://cardpop.com.au/scan"
      />

      <div className="max-w-3xl mx-auto px-4 py-10 md:py-16 space-y-8">
        {/* Hero */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider rounded-full px-3 py-1">
            <Sparkles className="w-3.5 h-3.5" /> Free price check
          </div>
          <h1 className="font-heading text-3xl md:text-5xl font-extrabold text-foreground text-balance">
            Scan any card. Know what it's worth.
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Point your camera at a raw card or a graded slab. CardPop identifies it and
            checks live market prices in AUD — then lists it for sale in a couple of clicks.
          </p>
        </div>

        {/* Capture / preview panel */}
        <div className="bg-card border border-border rounded-3xl p-6 md:p-8 space-y-5">
          {previewUrl ? (
            <div className="flex flex-col items-center gap-4">
              <img
                src={previewUrl}
                alt="Your card"
                className="max-h-80 rounded-2xl border border-border object-contain"
              />
              <div className="flex flex-wrap justify-center gap-3">
                {isAuthenticated ? (
                  <Button onClick={handleScan} disabled={!!phase} className="rounded-xl font-bold gap-2 h-11 px-6">
                    <ScanLine className="w-4 h-4" />
                    {phase ? PHASE_LABELS[phase] : (scan ? 'Scan again' : 'Identify & price this card')}
                  </Button>
                ) : (
                  <Button
                    onClick={() => navigate('/login', { state: { from: location } })}
                    className="rounded-xl font-bold gap-2 h-11 px-6"
                  >
                    <LogIn className="w-4 h-4" /> Sign in free to scan
                  </Button>
                )}
                <Button variant="outline" onClick={reset} disabled={!!phase} className="rounded-xl font-bold h-11">
                  Choose a different photo
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <ScanLine className="w-8 h-8 text-primary" />
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                <Button onClick={() => setShowCamera(true)} className="rounded-xl font-bold gap-2 h-11 px-6">
                  <Camera className="w-4 h-4" /> Use camera
                </Button>
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="rounded-xl font-bold gap-2 h-11 px-6">
                  <Upload className="w-4 h-4" /> Upload a photo
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center max-w-sm">
                Best results: fill the frame with the card, in even light. For graded slabs,
                include the label.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => acceptPhoto(e.target.files?.[0])}
              />
            </div>
          )}

          {!isAuthenticated && !previewUrl && (
            <p className="text-center text-sm text-muted-foreground border-t border-border pt-4">
              Scanning is free with a CardPop account —{' '}
              <Link to="/register" className="text-primary font-semibold hover:underline">create one</Link>{' '}
              or{' '}
              <Link to="/login" className="text-primary font-semibold hover:underline">sign in</Link>.
            </p>
          )}
        </div>

        {/* Result */}
        {scan && (
          identified ? (
            <div className="bg-card border border-border rounded-3xl p-6 md:p-8 space-y-6">
              {/* Identity */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-heading text-2xl font-extrabold text-foreground">
                    {ocr?.name || cs?.card?.name}
                  </h2>
                  {graded && (
                    <Badge className="bg-primary text-primary-foreground font-bold">
                      {ocr.gradingService} {ocr.gradeScore}
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground text-sm">
                  {[
                    ocr?.cardSetName || cs?.card?.setName,
                    ocr?.releaseYear || cs?.card?.year,
                    (ocr?.cardNumber || cs?.card?.cardNumber) && `#${ocr?.cardNumber || cs?.card?.cardNumber}`,
                    ocr?.collectionType,
                  ].filter(Boolean).join(' · ')}
                </p>
                {graded && ocr.certificationNumber && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Cert #{ocr.certificationNumber}
                  </p>
                )}
                {cs?.identified && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <BadgeCheck className="w-3.5 h-3.5 text-primary" /> Matched in the CardSight catalog
                  </p>
                )}
              </div>

              {/* Prices */}
              {(ebay?.count > 0 || cs?.pricing?.avgPrice) ? (
                <div className="grid sm:grid-cols-2 gap-4">
                  {ebay?.count > 0 && (
                    <div className="bg-muted/40 rounded-2xl p-5 space-y-1">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5" /> eBay asking prices
                      </p>
                      <p className="text-3xl font-extrabold tabular-nums text-foreground">{aud(ebay.avgPrice)} <span className="text-sm font-semibold text-muted-foreground">AUD avg</span></p>
                      <p className="text-sm text-muted-foreground tabular-nums">
                        Range {aud(ebay.minPrice)} – {aud(ebay.maxPrice)} · {ebay.count} current listing{ebay.count !== 1 ? 's' : ''} (AU + US, in AUD)
                      </p>
                    </div>
                  )}
                  {cs?.pricing?.avgPrice && (
                    <div className="bg-muted/40 rounded-2xl p-5 space-y-1">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" /> Catalog market average
                      </p>
                      <p className="text-3xl font-extrabold tabular-nums text-foreground">{aud(cs.pricing.avgPrice)} <span className="text-sm font-semibold text-muted-foreground">AUD</span></p>
                      <p className="text-sm text-muted-foreground">From CardSight recorded sales</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground bg-muted/40 rounded-2xl p-5">
                  No live price data found for this exact card. Rare and niche cards often
                  have thin listings — try the{' '}
                  <Link to="/analytics" className="text-primary font-semibold hover:underline">market analytics</Link>{' '}
                  search for a broader look.
                </p>
              )}

              {/* CTAs */}
              <div className="flex flex-wrap gap-3 pt-1">
                <Button asChild className="rounded-xl font-bold gap-2 h-11 px-6">
                  <Link to="/vault/add"><Plus className="w-4 h-4" /> List this card on CardPop</Link>
                </Button>
                <Button variant="outline" onClick={reset} className="rounded-xl font-bold gap-2 h-11">
                  <RefreshCw className="w-4 h-4" /> Scan another card
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Prices are live asking prices, not sold prices, and move with the market —
                treat them as a guide, not a valuation.
              </p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-3xl p-6 md:p-8 text-center space-y-3">
              <p className="font-bold text-foreground">We couldn't identify that card</p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Try a sharper photo with the card filling the frame — or a shot of the back,
                where set codes and collector numbers are printed.
              </p>
              <Button variant="outline" onClick={reset} className="rounded-xl font-bold">Try again</Button>
            </div>
          )
        )}

        {/* How it works */}
        {!scan && (
          <div className="grid sm:grid-cols-3 gap-4 text-center">
            {[
              { Icon: Camera, title: 'Snap it', desc: 'Camera or photo — raw cards and graded slabs both work.' },
              { Icon: ScanLine, title: 'We identify it', desc: 'AI reads the card and matches it against real card catalogs.' },
              { Icon: TrendingUp, title: 'See live prices', desc: 'Current eBay AU/US prices in AUD, plus catalog averages.' },
            ].map(({ Icon, title, desc }) => (
              <div key={title} className="bg-card border border-border rounded-2xl p-5 space-y-2">
                <Icon className="w-6 h-6 text-primary mx-auto" />
                <p className="font-bold text-sm text-foreground">{title}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCamera && (
        <Suspense fallback={null}>
          <CardScanCamera
            onCapture={f => { setShowCamera(false); acceptPhoto(f); }}
            onCancel={() => setShowCamera(false)}
          />
        </Suspense>
      )}
    </div>
  );
};

export default ScanPage;
