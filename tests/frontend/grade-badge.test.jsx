import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import GradeBadge, { GRADE_BADGE } from '@/components/GradeBadge.jsx';

describe('GradeBadge', () => {
  it('renders the grade value', () => {
    render(<GradeBadge grade="PSA 10" />);
    expect(screen.getByText('PSA 10')).toBeInTheDocument();
  });

  it('sets an aria-label describing the grade', () => {
    render(<GradeBadge grade="BGS 9.5" />);
    expect(screen.getByLabelText('Card Grade: BGS 9.5')).toBeInTheDocument();
  });

  it('renders nothing when grade is not provided', () => {
    const { container } = render(<GradeBadge />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when grade is null', () => {
    const { container } = render(<GradeBadge grade={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('applies an extra className when provided', () => {
    render(<GradeBadge grade="10" className="custom-class" />);
    expect(screen.getByLabelText('Card Grade: 10').className).toContain('custom-class');
  });

  it('keeps every grading-company colour at WCAG AA contrast for its white text', () => {
    // Tailwind's hex for each background shade the badges use.
    const HEX = {
      'red-600': '#dc2626', 'blue-700': '#1d4ed8', 'green-700': '#15803d',
      'orange-700': '#c2410c', 'purple-600': '#9333ea', 'slate-600': '#475569',
    };
    const lum = (hex) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    for (const [company, classes] of Object.entries(GRADE_BADGE)) {
      const shade = classes.match(/bg-([a-z]+-\d{3})/)?.[1];
      expect(HEX[shade], `${company}: add ${shade} to HEX`).toBeDefined();
      expect((1.05) / (lum(HEX[shade]) + 0.05), `${company} (${shade})`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
