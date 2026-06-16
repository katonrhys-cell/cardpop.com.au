import React from 'react';
import { Link } from 'react-router-dom';
import { Camera, CheckCircle2, XCircle } from 'lucide-react';
import SEOHead from '@/components/SEOHead.jsx';
import InfoPageLayout from '@/components/InfoPageLayout.jsx';

const EQUIPMENT_LEVELS = [
  {
    name: 'Beginner',
    budget: '$0 – $100',
    items: ['Modern iPhone or Android', 'Small tripod', 'White poster board', 'Natural window light'],
  },
  {
    name: 'Recommended',
    budget: '$200 – $500',
    items: ['iPhone 15/16 Pro or equivalent', 'Overhead phone mount', 'Two LED panels', 'Light diffusion panels'],
  },
  {
    name: 'Professional',
    budget: '$1,000+',
    items: ['Mirrorless camera', 'Macro lens', 'Professional LED lighting', 'Copy stand'],
  },
];

const ALLOWED = ['Original photos of the actual card', 'Multiple angles', 'Natural colour correction'];
const NOT_ALLOWED = ['Filters', 'Excessive sharpening', 'Colour manipulation', 'Stock photos'];

const PhotographyStandardPage = () => {
  return (
    <InfoPageLayout
      title="CardPop Photography Standard"
      description="Our v1.0 standard for listing photos — so every card on CardPop looks professional and buyers know exactly what they're getting."
      eyebrow="Seller Guide"
      icon={Camera}
    >
      <SEOHead
        title="Photography Standard | CardPop"
        description="The CardPop Photography Standard: equipment recommendations, image requirements, graded card photo rules and quality guidelines for trading card listings."
      />

      <p>
        Photography is part of the CardPop brand. Consistent, high-quality photos build buyer
        confidence, reduce disputes and make even average cards look professional. Every listing
        photo is checked against this standard and given a <strong>Photo Quality Score</strong> when
        you upload it.
      </p>

      <h2>Equipment Levels</h2>
      <p>You don't need expensive gear to meet the standard — a modern phone and window light are enough to start.</p>
      <div className="not-prose grid md:grid-cols-3 gap-4 mt-3 mb-8">
        {EQUIPMENT_LEVELS.map((level) => (
          <div key={level.name} className="rounded-2xl border border-border bg-card p-5">
            <h3 className="font-bold text-foreground mb-0.5">{level.name}</h3>
            <p className="text-sm text-primary font-semibold mb-3">{level.budget}</p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {level.items.map((item) => (
                <li key={item} className="flex gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <h2>Image Requirements</h2>

      <h3>Main Listing Image</h3>
      <ul>
        <li>Front of the card only</li>
        <li>Portrait orientation</li>
        <li>White background</li>
        <li>Card fills approximately 85% of the image</li>
        <li><strong>Size:</strong> 1200 × 1680px</li>
      </ul>

      <h3>Secondary Images</h3>
      <ol>
        <li>Back of card</li>
        <li>Surface close-up</li>
        <li>Corner close-up</li>
        <li>Edge close-up</li>
        <li>Serial number (if applicable)</li>
        <li>Autograph close-up (if applicable)</li>
      </ol>

      <h2>Graded Card Standard</h2>
      <p>Graded slabs require four photos. This reduces disputes and makes fake listings far easier to spot.</p>
      <ol>
        <li><strong>Image 1:</strong> Entire slab — front</li>
        <li><strong>Image 2:</strong> Entire slab — back</li>
        <li><strong>Image 3:</strong> Label close-up</li>
        <li><strong>Image 4:</strong> Angled photo showing the surface</li>
      </ol>

      <h2>Seller Upload Rules</h2>
      <p>Photos must represent the actual card you're selling. The following rules apply to all listings.</p>
      <div className="not-prose grid sm:grid-cols-2 gap-4 mt-3 mb-8">
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
          <h3 className="font-bold text-foreground mb-3">Allowed</h3>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {ALLOWED.map((item) => (
              <li key={item} className="flex gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
          <h3 className="font-bold text-foreground mb-3">Not Allowed</h3>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {NOT_ALLOWED.map((item) => (
              <li key={item} className="flex gap-2">
                <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p>
        Listings using stock photos or manipulated images may be removed under our{' '}
        <Link to="/trust-safety">Trust &amp; Safety</Link> policy.
      </p>

      <h2>Background Standard</h2>
      <p>Consistent backgrounds create a recognisable marketplace identity:</p>
      <ul>
        <li><strong>Raw cards:</strong> pure white background</li>
        <li><strong>Graded cards:</strong> light grey background</li>
        <li><strong>Premium auctions:</strong> CardPop branded background</li>
      </ul>

      <h2>Image Quality Tiers</h2>
      <ul>
        <li><strong>Minimum:</strong> 1200px tall</li>
        <li><strong>Recommended:</strong> 2000px+ tall</li>
        <li><strong>Premium:</strong> 3000px+ tall</li>
      </ul>
      <p>
        Higher resolution lets buyers zoom in on corners, edges, surface scratches and centering —
        the details that decide a sale.
      </p>

      <h2>Photo Quality Score</h2>
      <p>
        When you upload a listing photo, CardPop automatically checks it and shows a score out of
        100 based on:
      </p>
      <ul>
        <li><strong>Resolution</strong> — meets the minimum 1200px standard</li>
        <li><strong>Sharpness</strong> — blur detection</li>
        <li><strong>Lighting</strong> — exposure check</li>
        <li><strong>Glare</strong> — blown-highlight detection</li>
        <li><strong>Crop &amp; framing</strong> — card fills ~85% of the frame</li>
      </ul>
      <p>
        The score is guidance for you, not a gate — but listings with higher scores consistently
        attract more buyer confidence.
      </p>

      <h2>Watermarks</h2>
      <p>
        Do <strong>not</strong> watermark the main card image — collectors dislike large visible
        watermarks. CardPop applies a small logo to gallery images and an invisible digital
        watermark in image metadata to protect your photos.
      </p>

      <h2>Coming Soon: CardPop Scan Verified</h2>
      <p>
        We're building automated condition estimation: upload front and back scans and CardPop will
        detect centering, corner wear, edge wear and surface defects, then display an estimated
        condition (Mint, Near Mint, Excellent, Very Good) alongside your listing. In the meantime,
        learn more about condition in our <Link to="/grading">Grading Hub</Link>.
      </p>
    </InfoPageLayout>
  );
};

export default PhotographyStandardPage;
