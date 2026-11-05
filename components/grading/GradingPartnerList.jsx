import React, { useState } from 'react';
import { ExternalLink, MapPin } from 'lucide-react';
import GraderLogo from '@/components/grading/GraderLogo.jsx';
import { GRADING_COMPANIES, graderStyle } from '@/data/gradingCompanies.js';
import {
  companyForKey, normaliseCompanyKey, partnerCountsByCompany, partnerDomain, partnerLinkFor, partnersForCompany, cleanCompanies,
} from '@/utils/gradingPartners.js';
import { Skeleton } from '@/components/ui/skeleton';

const CATEGORY_COLORS = {
  TCG: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  'Sports Cards': 'bg-green-500/10 text-green-600 dark:text-green-400',
  AFL: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  NRL: 'bg-green-500/10 text-green-600 dark:text-green-400',
  NBA: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

function PartnerFavicon({ website, name }) {
  const [err, setErr] = useState(false);
  const domain = partnerDomain(website);
  if (err || !domain) {
    return (
      <span className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-base">
        {String(name || '?').charAt(0)}
      </span>
    );
  }
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
      alt=""
      width={40}
      height={40}
      loading="lazy"
      className="w-10 h-10 rounded-lg object-contain bg-white p-1 border border-border"
      onError={() => setErr(true)}
    />
  );
}

export function GradingPartnerCard({ partner, companyKey }) {
  const href = partnerLinkFor(partner, companyKey);
  const companies = cleanCompanies(partner.companies).map(companyForKey).filter(Boolean);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="flex gap-4 bg-card border border-border rounded-2xl p-5 hover:border-primary/50 hover:shadow-md transition-all group"
      data-partner={partner.slug}
    >
      <PartnerFavicon website={partner.website} name={partner.name} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <h3 className="font-bold leading-tight group-hover:text-primary transition-colors">{partner.name}</h3>
          {partner.location && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3" /> {partner.location}
            </span>
          )}
        </div>
        {partner.description && (
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">{partner.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground mr-0.5">Submits to</span>
          {companies.map((g) => (
            <span
              key={g.key}
              className="inline-flex items-center h-6 px-1.5 rounded-md border border-[var(--grader-border)] dark:border-[var(--grader-border-dark)] bg-[var(--grader-tint)] dark:bg-[var(--grader-tint-dark)]"
              style={graderStyle(g)}
              title={g.full}
            >
              <GraderLogo grader={g} height={12} wordmarkClassName="text-[10px]" />
            </span>
          ))}
          {(partner.categories || []).map((cat) => (
            <span key={cat} className={`text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[cat] ?? 'bg-muted text-muted-foreground'}`}>
              {cat}
            </span>
          ))}
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-primary font-medium">
            Visit <ExternalLink className="w-3 h-3" />
          </span>
        </div>
      </div>
    </a>
  );
}

/**
 * The Australian submission partners, filterable by grading company: a row of
 * company chips (with how many partners each has), the company's own
 * direct-submission note, then one card per partner linking to that partner's
 * page for the selected company. `selected` is a lower-case key or null for all.
 */
export default function GradingPartnerList({ partners, loading = false, selected = null, onSelect, fromSeed = false, idPrefix = 'grading-partners' }) {
  const key = normaliseCompanyKey(selected);
  const counts = partnerCountsByCompany(partners);
  const visible = partnersForCompany(partners, key);
  const company = key ? companyForKey(key) : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Grading company">
        <button
          type="button"
          role="tab"
          aria-selected={!key}
          onClick={() => onSelect?.(null)}
          className={`h-9 px-3 rounded-full border text-sm font-semibold transition-colors ${!key ? 'bg-foreground text-background border-foreground' : 'bg-card border-border hover:border-primary/50'}`}
        >
          All partners
        </button>
        {GRADING_COMPANIES.map((g) => {
          const k = g.key.toLowerCase();
          const active = key === k;
          return (
            <button
              key={g.key}
              type="button"
              role="tab"
              aria-selected={active}
              id={`${idPrefix}-tab-${k}`}
              onClick={() => onSelect?.(k)}
              style={graderStyle(g)}
              className={`inline-flex items-center gap-2 h-9 pl-2.5 pr-3 rounded-full border text-sm font-semibold transition-colors ${active ? 'bg-[var(--grader-tint)] dark:bg-[var(--grader-tint-dark)] border-[var(--grader-ink)] dark:border-[var(--grader-ink-dark)]' : 'bg-card border-border hover:border-[var(--grader-border)] dark:hover:border-[var(--grader-border-dark)]'}`}
            >
              <GraderLogo grader={g} height={14} wordmarkClassName="text-xs" />
              <span className="sr-only">{g.full}</span>
              <span className="text-xs font-bold tabular-nums text-muted-foreground">{counts[k] ?? 0}</span>
            </button>
          );
        })}
      </div>

      {company && (
        <div
          className="rounded-2xl border border-[var(--grader-border)] dark:border-[var(--grader-border-dark)] bg-[var(--grader-tint)] dark:bg-[var(--grader-tint-dark)] px-5 py-4"
          style={graderStyle(company)}
          data-company-note={company.key}
        >
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <GraderLogo grader={company} height={22} wordmarkClassName="text-lg" />
              <span className="font-semibold">Submitting to {company.name} from Australia</span>
            </div>
            {company.submit?.url && (
              <a href={company.submit.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-sm text-primary font-medium hover:underline">
                {company.name}'s submission page <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
          {company.submit?.note && <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{company.submit.note}</p>}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}</div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground" data-empty-partners>
          {company
            ? `No Australian partner for ${company.name} is listed yet. ${company.submit?.url ? `Use ${company.name}'s own submission page above, or` : 'Or'} tell us about one and we'll add it.`
            : 'No submission partners are listed yet.'}
        </div>
      ) : (
        <div className="space-y-3" data-partner-list>
          {visible.map((p) => <GradingPartnerCard key={p.slug || p.id} partner={p} companyKey={key} />)}
        </div>
      )}

      {fromSeed && (
        <p className="text-[11px] text-muted-foreground">Showing the built-in list; live updates could not be loaded.</p>
      )}
    </div>
  );
}
