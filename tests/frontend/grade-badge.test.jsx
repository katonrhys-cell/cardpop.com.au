import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import GradeBadge from '@/components/GradeBadge.jsx';

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
});
