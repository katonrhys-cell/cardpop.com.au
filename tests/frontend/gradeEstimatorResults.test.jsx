import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import GradeInspectionPhoto from '@/components/grading/GradeInspectionPhoto.jsx';
import { normaliseGradeGeometry } from '@/utils/gradeFindings.js';

const RESULT = vi.hoisted(() => ({
  cardIdentification: { name: 'LeBron James', set: 'Topps Chrome Basketball (Lakers-themed design)', year: '2024-25', type: 'Green Wave Refractor /99' },
  conditionAnalysis: {
    centering: { assessment: 'Roughly 55/45 left to right.', score: 'good' },
    corners: { assessment: 'Sharp.', score: 'excellent' },
    edges: { assessment: 'Clean.', score: 'good' },
    surface: { assessment: 'One light scratch.', score: 'fair' },
  },
  overallCondition: 'Based on the front only, the card appears Near Mint-Mint',
  findings: [{ factor: 'surface', side: 'front', x: 40, y: 60, w: 10, h: 5, severity: 'moderate', description: 'Light scratch' }],
  grades: {
    PSA: { estimate: 8, range: '7-9', label: 'NM-MT', confidence: 'medium', notes: '' },
    BGS: { estimate: 8.5, range: '8-9', label: 'NM-MT+', confidence: 'low', subGrades: { centering: 8.5, corners: 9, edges: 9, surface: 8 } },
  },
}));

vi.mock('@/contexts/AuthContext.jsx', () => ({ useAuth: () => ({ isAuthenticated: true }) }));
vi.mock('@/components/SEOHead.jsx', () => ({ default: () => null }));
vi.mock('@/hooks/useGradeEstimator.js', () => ({
  useGradeEstimator: () => ({ estimateGrade: vi.fn(), isAnalysing: false, result: RESULT, error: null, reset: vi.fn() }),
}));

import GradeEstimatorPage from '@/pages/grading/GradeEstimatorPage.jsx';

describe('Grade estimator results', () => {
  it('shows a grades-at-a-glance table with one row per returned company', () => {
    render(<MemoryRouter><GradeEstimatorPage /></MemoryRouter>);
    const table = screen.getByTestId('grade-summary');
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(3); // header + PSA + BGS
    expect(within(rows[1]).getByText('8')).toBeTruthy();
    expect(within(rows[1]).getByText('7-9')).toBeTruthy();
    expect(within(rows[2]).getByText('8.5')).toBeTruthy();
  });

  it('lays a long overall condition out as text, not a one-line pill', () => {
    render(<MemoryRouter><GradeEstimatorPage /></MemoryRouter>);
    const overall = screen.getByText(/Based on the front only/);
    expect(overall.closest('p').className).not.toMatch(/whitespace-nowrap/);
    expect(screen.getByText('Topps Chrome Basketball (Lakers-themed design)')).toBeTruthy();
  });

  it('opens a factor to show its assessment and its numbered spots', () => {
    render(<MemoryRouter><GradeEstimatorPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('tab', { name: /Surface/ }));
    expect(screen.getByText('One light scratch.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Light scratch/ })).toBeTruthy();
  });
});

describe('GradeInspectionPhoto', () => {
  const geometry = normaliseGradeGeometry({
    cardLocation: { front: { x: 10, y: 5, w: 80, h: 90 } },
    centeringMeasured: { front: { leftRight: '55/45', topBottom: '50/50' } },
    findings: [
      { factor: 'surface', side: 'front', x: 40, y: 60, w: 10, h: 5, severity: 'major', description: 'Crease' },
      { factor: 'corners', side: 'front', x: 10, y: 5, w: 6, h: 6, severity: 'minor', description: 'Soft corner' },
    ],
  }, { hasBack: false });

  it('draws every finding over the photo at its percent position', () => {
    const { container } = render(<GradeInspectionPhoto src="blob:x" alt="front" side="front" geometry={geometry} />);
    const marks = container.querySelectorAll('[data-finding]');
    expect(marks).toHaveLength(2);
    const crease = container.querySelector('[data-finding="2"]');
    expect(crease.style.left).toBe('40%');
    expect(crease.style.top).toBe('60%');
    expect(container.querySelector('[data-overlay="card"]').style.width).toBe('80%');
  });

  it('shows only the active factor\'s findings, and centering guides with the ratios', () => {
    const { container, rerender } = render(<GradeInspectionPhoto src="blob:x" alt="front" side="front" geometry={geometry} activeFactor="surface" />);
    expect(container.querySelectorAll('[data-finding]')).toHaveLength(1);
    rerender(<GradeInspectionPhoto src="blob:x" alt="front" side="front" geometry={geometry} activeFactor="centering" />);
    expect(screen.getByText('L/R 55/45')).toBeTruthy();
    expect(screen.getByText('T/B 50/50')).toBeTruthy();
  });

  it('highlights the edges themselves when no edge flaw was pinpointed', () => {
    const { container } = render(<GradeInspectionPhoto src="blob:x" alt="front" side="front" geometry={geometry} activeFactor="edges" scores={{ edges: 'good' }} />);
    expect(container.querySelector('[data-overlay="edges"]')).toBeTruthy();
  });

  it('reports a tapped finding', () => {
    const onSelect = vi.fn();
    render(<GradeInspectionPhoto src="blob:x" alt="front" side="front" geometry={geometry} onSelectFinding={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /Finding 2: Crease/ }));
    expect(onSelect).toHaveBeenCalledWith(2);
  });
});
