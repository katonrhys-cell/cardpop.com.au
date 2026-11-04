import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import GraderLogo from '@/components/grading/GraderLogo.jsx';
import SlabLabel from '@/components/grading/SlabLabel.jsx';
import {
  GRADING_COMPANIES, graderStyle, withAlpha, findGradingCompany, slabLabelTier, SLAB_LABEL_LOOKS,
} from '@/data/gradingCompanies.js';

const psa = findGradingCompany('psa');

describe('gradingCompanies data', () => {
  it('lists the six graders the estimator prompt returns, each with a brand colour and a logo path', () => {
    expect(GRADING_COMPANIES.map((g) => g.key)).toEqual(['PSA', 'BGS', 'CGC', 'ACE', 'SGC', 'TAG']);
    for (const g of GRADING_COMPANIES) {
      expect(g.brand.primary).toMatch(/^#[0-9A-F]{6}$/i);
      expect(g.logo).toMatch(/^\/images\/grading\/[a-z-]+\.(svg|png)$/);
      expect(typeof g.brand.verified).toBe('boolean');
    }
  });

  it('derives tint and border from the one primary hex', () => {
    expect(withAlpha('#E4002B', 0.08)).toBe('#E4002B14');
    expect(withAlpha('not-a-hex', 0.5)).toBe('not-a-hex');
    const style = graderStyle(psa);
    expect(style['--grader-ink']).toBe(psa.brand.primary);
    expect(style['--grader-tint']).toBe(withAlpha(psa.brand.primary, 0.08));
    expect(style['--grader-border']).toBe(withAlpha(psa.brand.primary, 0.3));
  });
});

describe('GraderLogo', () => {
  it('renders the official logo file when there is one', () => {
    render(<GraderLogo grader={psa} />);
    const img = screen.getByAltText('Professional Sports Authenticator logo');
    expect(img.getAttribute('src')).toBe('/images/grading/psa.svg');
  });

  it('falls back to a brand-coloured wordmark when the file is missing', () => {
    render(<GraderLogo grader={psa} />);
    fireEvent.error(screen.getByAltText('Professional Sports Authenticator logo'));
    expect(screen.queryByRole('img')).toBeNull();
    const mark = screen.getByText('PSA');
    expect(mark.className).toContain('text-[var(--grader-ink)]');
    expect(mark.parentElement.style.getPropertyValue('--grader-ink')).toBe(psa.brand.primary);
  });

  it('shows the dark-mode file alongside the light one when a company publishes both', () => {
    const sgc = findGradingCompany('SGC');
    render(<GraderLogo grader={sgc} />);
    const imgs = screen.getAllByAltText('Sportscard Guaranty Corporation logo');
    expect(imgs.map((i) => i.getAttribute('src'))).toEqual([sgc.logo, sgc.logoDark]);
    expect(imgs[0].className).toContain('dark:hidden');
    expect(imgs[1].className).toContain('dark:block');
  });

  it('renders nothing without a grader', () => {
    const { container } = render(<GraderLogo grader={null} />);
    expect(container.innerHTML).toBe('');
  });
});


describe('slab label tiers', () => {
  const bgs = findGradingCompany('BGS');
  const tens = { centering: 10, corners: 10, edges: 10, surface: 10 };

  it('picks the BGS label stock by grade: silver, gold from 9.5, Black Label for a 10 with four 10s', () => {
    expect(slabLabelTier(bgs, { estimate: 8.5 })).toBe('silver');
    expect(slabLabelTier(bgs, { estimate: 9.5 })).toBe('gold');
    expect(slabLabelTier(bgs, { estimate: 10, subGrades: { ...tens, surface: 9.5 } })).toBe('gold');
    expect(slabLabelTier(bgs, { estimate: 10, subGrades: tens })).toBe('black');
  });

  it('keeps PSA and SGC on their one label whatever the grade', () => {
    expect(slabLabelTier(findGradingCompany('PSA'), { estimate: 10 })).toBe('psa');
    expect(slabLabelTier(findGradingCompany('SGC'), { estimate: 10 })).toBe('black');
    expect(slabLabelTier(findGradingCompany('CGC'), { estimate: 10 })).toBe('gold');
    expect(slabLabelTier(findGradingCompany('CGC'), { estimate: '9.5' })).toBe('black');
  });

  it('falls back to the default tier for a non-numeric estimate', () => {
    expect(slabLabelTier(bgs, { estimate: null })).toBe('silver');
    expect(SLAB_LABEL_LOOKS[slabLabelTier(bgs, { estimate: 'n/a' })]).toBeDefined();
  });
});

describe('SlabLabel', () => {
  it('draws the BGS estimate on a silver label with its sub-grades printed on the label', () => {
    const bgs = findGradingCompany('BGS');
    const { container } = render(
      <SlabLabel grader={bgs} estimate={8.5} label="NM-MT+" range="8-9" subGrades={{ centering: 9, corners: 8.5, edges: 8.5, surface: 8.5 }} />,
    );
    const root = container.firstChild;
    expect(root.getAttribute('data-slab-tier')).toBe('silver');
    expect(screen.getByText('8.5', { selector: 'span' })).toBeTruthy();
    expect(screen.getByText('NM-MT+')).toBeTruthy();
    expect(screen.getByText('centering')).toBeTruthy();
    expect(screen.getAllByText('8.5').length).toBeGreaterThan(1);
  });

  it('puts the PSA mark in a red band above a white body', () => {
    const { container } = render(<SlabLabel grader={psa} estimate={8} label="NM-MT" range="7-9" />);
    const root = container.firstChild;
    expect(root.getAttribute('data-slab-tier')).toBe('psa');
    const band = root.firstChild;
    expect(band.style.background.toLowerCase()).toMatch(/#e4002b|rgb\(228, 0, 43\)/);
    expect(screen.getByAltText('Professional Sports Authenticator logo').getAttribute('src')).toBe(psa.logo);
    expect(screen.getByText('8')).toBeTruthy();
  });

  it('shows the dash for a missing estimate rather than throwing', () => {
    render(<SlabLabel grader={findGradingCompany('SGC')} estimate={undefined} label="" />);
    expect(screen.getByText('—', { selector: 'span' })).toBeTruthy();
  });
});
