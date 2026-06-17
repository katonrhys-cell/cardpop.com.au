import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import SEOHead from '@/components/SEOHead.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TrendingUp, ArrowLeft, Calculator, AlertTriangle, CheckCircle,
  XCircle, Loader2, Info, DollarSign, BarChart2,
} from 'lucide-react';
import apiServerClient from '@/lib/apiServerClient.js';

// ─── GRADING SERVICE CONFIG ───────────────────────────────────────────────────
const GRADING_SERVICES = [
  {
    id: 'PSA',
    label: 'PSA (via AU partner)',
    fee: 48,         // AUD – Value Bulk tier via Slabbys/SLABD
    grades: ['10', '9', '8'],
    defaultGemRate: 15,   // % chance of gem-mint 10
    defaultNineRate: 40,  // % chance of mint 9
  },
  {
    id: 'BGS',
    label: 'BGS / Beckett (via AU partner)',
    fee: 45,
    grades: ['10', '9.5', '9', '8'],
    defaultGemRate: 10,
    defaultNineRate: 35,
  },
  {
    id: 'ACE',
    label: 'ACE Grading (Australian)',
    fee: 25,
    grades: ['10', '9', '8'],
    defaultGemRate: 20,
    defaultNineRate: 45,
  },
  {
    id: 'ARK',
    label: 'ARK Grading (Australian)',
    fee: 20,
    grades: ['10', '9', '8'],
    defaultGemRate: 20,
    defaultNineRate: 45,
  },
];

const DEFAULT_SHIPPING = 30; // AUD – international round-trip estimate

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const currency = (v) =>
  v == null ? '—' : `$${Math.abs(v).toFixed(2)}`;

const pct = (v) => `${v.toFixed(1)}%`;

function calcROI({ rawCost, gradingFee, shipping, gemRate, nineRate, tenPrice, ninePrice }) {
  const totalCost = rawCost + gradingFee + shipping;
  const weightedRevenue =
    (tenPrice * gemRate / 100) +
    (ninePrice * nineRate / 100);
  const netProfit = weightedRevenue - totalCost;
  const roi = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;
  const breakEvenRawCost = weightedRevenue - gradingFee - shipping;
  return { totalCost, weightedRevenue, netProfit, roi, breakEvenRawCost };
}

// ─── FETCH PRICE ESTIMATE ─────────────────────────────────────────────────────
async function fetchPrice(name, service, gradeScore) {
  const params = new URLSearchParams({ name, gradingService: service, gradeScore });
  const res = await apiServerClient.fetch(`/ebay/price-estimate?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchRawPrice(name) {
  const params = new URLSearchParams({ name, gradingService: 'None' });
  const res = await apiServerClient.fetch(`/ebay/price-estimate?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── ROI BADGE ────────────────────────────────────────────────────────────────
function ROIBadge({ roi, netProfit }) {
  if (netProfit > 0 && roi >= 30) {
    return (
      <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
        <CheckCircle className="w-5 h-5" />
        <span className="font-bold">Strong Opportunity</span>
      </div>
    );
  }
  if (netProfit > 0) {
    return (
      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
        <AlertTriangle className="w-5 h-5" />
        <span className="font-bold">Marginal — Proceed Cautiously</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
      <XCircle className="w-5 h-5" />
      <span className="font-bold">Negative Expected Return</span>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
const GradingROIPage = () => {
  const [cardName, setCardName] = useState('');
  const [rawCost, setRawCost] = useState('');
  const [serviceId, setServiceId] = useState('PSA');
  const [shipping, setShipping] = useState(DEFAULT_SHIPPING);
  const [gemRate, setGemRate] = useState(null);   // null = use service default
  const [nineRate, setNineRate] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const service = GRADING_SERVICES.find(s => s.id === serviceId);
  const effectiveGemRate  = gemRate  ?? service.defaultGemRate;
  const effectiveNineRate = nineRate ?? service.defaultNineRate;

  const analyse = useCallback(async () => {
    const rawCostNum = parseFloat(rawCost);
    if (!cardName.trim()) return setError('Enter a card name.');
    if (isNaN(rawCostNum) || rawCostNum <= 0) return setError('Enter a valid raw cost.');

    setError(null);
    setLoading(true);
    setResult(null);

    try {
      const topGrade = service.grades[0];
      const secondGrade = service.grades.find(g => g !== topGrade) || service.grades[1];

      const [rawData, tenData, nineData] = await Promise.all([
        fetchRawPrice(cardName),
        fetchPrice(cardName, service.id, topGrade),
        fetchPrice(cardName, service.id, secondGrade),
      ]);

      const tenPrice  = tenData.avgPrice  || 0;
      const ninePrice = nineData.avgPrice || 0;
      const rawAvgPrice = rawData.avgPrice || rawCostNum;

      const calc = calcROI({
        rawCost: rawCostNum,
        gradingFee: service.fee,
        shipping,
        gemRate: effectiveGemRate,
        nineRate: effectiveNineRate,
        tenPrice,
        ninePrice,
      });

      setResult({
        ...calc,
        tenPrice,
        ninePrice,
        rawAvgPrice,
        topGrade,
        secondGrade,
        tenCount:  tenData.count  || 0,
        nineCount: nineData.count || 0,
        rawCount:  rawData.count  || 0,
        cardName: cardName.trim(),
      });
    } catch (err) {
      setError(`Failed to fetch eBay data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [cardName, rawCost, service, shipping, effectiveGemRate, effectiveNineRate]);

  const handleKey = (e) => { if (e.key === 'Enter') analyse(); };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Grading ROI Calculator | CardPop — Is It Worth Grading?"
        description="Calculate the probability-weighted return on investment before grading your trading cards. Factor in live eBay prices, PSA/BGS/ACE fees, shipping, and gem-mint rates."
        keywords="card grading ROI calculator, PSA grading worth it, grading investment calculator, pokemon grading australia, BGS ROI"
      />

      {/* Hero */}
      <section className="bg-card border-b border-border py-16 text-center">
        <div className="container-default">
          <TrendingUp className="w-12 h-12 text-primary mx-auto mb-5" />
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Grading ROI Calculator</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Enter a card, plug in your costs, and get a probability-weighted expected return —
            powered by live eBay AU sold data.
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">

        <Link
          to="/grading"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Grading Hub
        </Link>

        {/* Formula explainer */}
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 flex gap-4">
          <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">How it works: </span>
            Expected Net Profit = (Grade-10 Price × Gem Rate%) + (Grade-9 Price × Nine Rate%) − (Raw Cost + Grading Fee + Shipping).
            Prices are pulled live from eBay AU listings. Adjust the grade probability sliders to match your card's known gem rate.
          </div>
        </div>

        {/* Input panel */}
        <div className="bg-card border border-border rounded-3xl p-8 space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary" /> Card Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Card name */}
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="cardName">Card Name</Label>
              <Input
                id="cardName"
                placeholder='e.g. "Charizard Base Set Holo" or "Zion Williamson Prizm Rookie"'
                value={cardName}
                onChange={e => setCardName(e.target.value)}
                onKeyDown={handleKey}
              />
              <p className="text-xs text-muted-foreground">
                Be specific — the more precise the search, the more accurate the live price data.
              </p>
            </div>

            {/* Raw cost */}
            <div className="space-y-2">
              <Label htmlFor="rawCost">Your Raw Cost (AUD)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input
                  id="rawCost"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="pl-7"
                  value={rawCost}
                  onChange={e => setRawCost(e.target.value)}
                  onKeyDown={handleKey}
                />
              </div>
            </div>

            {/* Grading service */}
            <div className="space-y-2">
              <Label>Grading Service</Label>
              <Select value={serviceId} onValueChange={v => { setServiceId(v); setGemRate(null); setNineRate(null); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GRADING_SERVICES.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label} — ${s.fee} AUD
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Shipping */}
            <div className="space-y-2">
              <Label htmlFor="shipping">Shipping + Handling (AUD)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input
                  id="shipping"
                  type="number"
                  min="0"
                  step="1"
                  className="pl-7"
                  value={shipping}
                  onChange={e => setShipping(parseFloat(e.target.value) || 0)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Include both-way postage, insurance, and customs for international services.
              </p>
            </div>

            {/* Grading fee display */}
            <div className="space-y-2">
              <Label>Grading Fee</Label>
              <div className="h-10 px-3 flex items-center bg-muted rounded-md text-sm font-medium">
                ${service.fee}.00 AUD
              </div>
              <p className="text-xs text-muted-foreground">Base tier via Australian submission partner.</p>
            </div>
          </div>

          {/* Gem rate sliders */}
          <div className="space-y-5 pt-2 border-t border-border">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-primary" />
              Grade Probability Estimates
              <span className="font-normal text-muted-foreground ml-1">(adjust to match your card's known gem rate)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <Label>Gem Mint ({service.grades[0]}) Probability</Label>
                  <span className="font-bold text-primary">{effectiveGemRate}%</span>
                </div>
                <Slider
                  min={1}
                  max={80}
                  step={1}
                  value={[effectiveGemRate]}
                  onValueChange={([v]) => setGemRate(v)}
                />
                <p className="text-xs text-muted-foreground">
                  Default {service.defaultGemRate}% based on typical {service.id} population data.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <Label>Mint ({service.grades[1] || service.grades[0]}) Probability</Label>
                  <span className="font-bold text-primary">{effectiveNineRate}%</span>
                </div>
                <Slider
                  min={1}
                  max={80}
                  step={1}
                  value={[effectiveNineRate]}
                  onValueChange={([v]) => setNineRate(v)}
                />
                <p className="text-xs text-muted-foreground">
                  Default {service.defaultNineRate}% based on typical {service.id} outcomes.
                </p>
              </div>
            </div>

            {effectiveGemRate + effectiveNineRate > 95 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Combined probability exceeds 95% — consider that a portion of cards grade below both tiers.
              </p>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
              <XCircle className="w-4 h-4" /> {error}
            </p>
          )}

          <Button
            className="w-full"
            size="lg"
            onClick={analyse}
            disabled={loading}
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Fetching live eBay prices…</>
            ) : (
              <><TrendingUp className="w-4 h-4 mr-2" /> Calculate ROI</>
            )}
          </Button>
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Verdict */}
            <div className={`rounded-3xl border p-7 ${
              result.netProfit > 0 && result.roi >= 30
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                : result.netProfit > 0
                  ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
                  : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">"{result.cardName}"</p>
                  <ROIBadge roi={result.roi} netProfit={result.netProfit} />
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold">
                    {result.netProfit >= 0 ? '+' : '−'}{currency(result.netProfit)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Expected net profit ({result.roi >= 0 ? '+' : ''}{pct(result.roi)} ROI)
                  </p>
                </div>
              </div>
            </div>

            {/* Price data */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-card border border-border rounded-2xl p-5 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Raw Avg (eBay AU)</p>
                <p className="text-2xl font-bold">{currency(result.rawAvgPrice)}</p>
                <p className="text-xs text-muted-foreground mt-1">{result.rawCount} listings</p>
              </div>
              <div className="bg-card border border-border rounded-2xl p-5 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{serviceId} {result.topGrade} Avg</p>
                <p className="text-2xl font-bold text-primary">{currency(result.tenPrice)}</p>
                <p className="text-xs text-muted-foreground mt-1">{result.tenCount} listings</p>
              </div>
              <div className="bg-card border border-border rounded-2xl p-5 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{serviceId} {result.secondGrade} Avg</p>
                <p className="text-2xl font-bold">{currency(result.ninePrice)}</p>
                <p className="text-xs text-muted-foreground mt-1">{result.nineCount} listings</p>
              </div>
            </div>

            {/* Cost / revenue breakdown */}
            <div className="bg-card border border-border rounded-3xl p-7 space-y-4">
              <h3 className="font-bold flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" /> Full Breakdown
              </h3>
              <div className="space-y-2 text-sm">
                {[
                  ['Raw purchase cost',          `-${currency(parseFloat(rawCost))}`,       'text-red-600 dark:text-red-400'],
                  [`${serviceId} grading fee`,   `-${currency(service.fee)}`,               'text-red-600 dark:text-red-400'],
                  ['Shipping + handling',        `-${currency(shipping)}`,                  'text-red-600 dark:text-red-400'],
                  ['Total investment',           `-${currency(result.totalCost)}`,           'font-bold'],
                  null,
                  [`Weighted revenue (${pct(effectiveGemRate)} × ${currency(result.tenPrice)} + ${pct(effectiveNineRate)} × ${currency(result.ninePrice)})`,
                    `+${currency(result.weightedRevenue)}`,
                    'text-emerald-600 dark:text-emerald-400'],
                  null,
                  ['Expected net profit',
                    `${result.netProfit >= 0 ? '+' : '−'}${currency(result.netProfit)}`,
                    result.netProfit >= 0 ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'font-bold text-red-600 dark:text-red-400'],
                  ['Break-even raw card cost',  `${currency(result.breakEvenRawCost)}`,    'text-muted-foreground'],
                ].map((row, i) =>
                  row === null ? (
                    <hr key={i} className="border-border" />
                  ) : (
                    <div key={i} className="flex justify-between items-center">
                      <span className="text-muted-foreground">{row[0]}</span>
                      <span className={row[2]}>{row[1]}</span>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Interpretation tips */}
            <div className="bg-card border border-border rounded-3xl p-7 space-y-3">
              <h3 className="font-bold">Interpreting Your Result</h3>
              <ul className="text-sm text-muted-foreground space-y-2 leading-relaxed list-disc list-inside">
                {result.rawAvgPrice > 0 && result.tenPrice / result.rawAvgPrice < 3 && (
                  <li>
                    The graded-10 premium is less than 3× raw — a common threshold for grading to make economic sense.
                    This card may not be a strong grading candidate at current market prices.
                  </li>
                )}
                {result.breakEvenRawCost > 0 && (
                  <li>
                    You could pay up to <strong>{currency(result.breakEvenRawCost)}</strong> for this card raw and still break even
                    (after all grading and shipping costs, assuming these grade probabilities).
                  </li>
                )}
                {result.tenCount < 5 && (
                  <li>
                    Only {result.tenCount} live listings found for the {serviceId} {result.topGrade} — price data may be unreliable.
                    Check recent sold listings manually on eBay for confirmation.
                  </li>
                )}
                <li>
                  These figures use <em>live eBay AU asking prices</em>, not sold prices. Actual sold prices can be 10–20% lower.
                  Always verify on eBay's completed listings before committing.
                </li>
                <li>
                  Population report data is not included — a high-pop {serviceId} {result.topGrade} can be worth significantly
                  less than a low-pop equivalent. Check PSA or BGS population reports before submitting.
                </li>
              </ul>
            </div>

          </div>
        )}

        {/* Educational section */}
        {!result && (
          <div className="bg-card border border-border rounded-3xl p-8 space-y-4">
            <h2 className="text-xl font-bold">Finding the Best Growth Areas</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The highest-ROI opportunities share a few common traits. Use this checklist before
              submitting any card to a grading service.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {[
                {
                  title: 'Raw-to-graded spread ≥ 3–4×',
                  body: 'If a PSA 10 only sells for 2× the raw price, grading fees and shipping will eat most of the margin. Aim for cards where the gem-mint premium is at least 3–4× the raw cost.',
                },
                {
                  title: 'Low population report',
                  body: 'A card with only 50 PSA 10s on record is far more valuable than one with 50,000. Always check the PSA or BGS pop report before grading — high populations suppress premiums.',
                },
                {
                  title: 'Strong secondary market demand',
                  body: 'Key rookie cards, chase alt-arts, vintage holos, and low-numbered parallels hold their graded premiums best. Common cards rarely justify grading costs.',
                },
                {
                  title: 'Card must be raw-gem quality',
                  body: 'Even a 15% gem rate is optimistic on an average raw card. Centering, surface scratches, and print defects matter enormously. Only grade raw cards that are visually pristine.',
                },
              ].map(({ title, body }) => (
                <div key={title} className="bg-muted/40 rounded-2xl p-5">
                  <p className="font-semibold text-sm mb-1.5">{title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default GradingROIPage;
