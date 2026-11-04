import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import GraderLogo from '@/components/grading/GraderLogo.jsx';
import { GRADING_COMPANIES, graderStyle, withAlpha, findGradingCompany } from '@/data/gradingCompanies.js';

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
