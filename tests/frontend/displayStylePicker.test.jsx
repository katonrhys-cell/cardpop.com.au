import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import DisplayStylePicker from '@/components/vault/DisplayStylePicker.jsx';
import { DISPLAY_STYLES } from '@/lib/displayStyles.js';

describe('DisplayStylePicker', () => {
  it('renders a radio for every style', () => {
    render(<DisplayStylePicker value="classic" userTier="free" onChange={() => {}} />);
    expect(screen.getAllByRole('radio')).toHaveLength(DISPLAY_STYLES.length);
  });

  it('locks styles above the user tier and marks accessible ones', () => {
    render(<DisplayStylePicker value="classic" userTier="pro" onChange={() => {}} />);
    // Pro can use classic/stand/floating; the rest require a higher tier.
    expect(screen.getByLabelText('Classic Flat')).toBeInTheDocument();
    expect(screen.getByLabelText('Premium Stand')).toBeInTheDocument();
    expect(screen.getByLabelText(/Glass Museum \(requires Premium\)/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Rotating Premium \(requires Elite\)/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Holographic \(requires Ultimate\)/)).toBeInTheDocument();
  });

  it('selects an unlocked style via onChange', () => {
    const onChange = vi.fn();
    render(<DisplayStylePicker value="classic" userTier="premium" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Slab Display'));
    expect(onChange).toHaveBeenCalledWith('slab');
  });

  it('does not select a locked style', () => {
    const onChange = vi.fn();
    render(<DisplayStylePicker value="classic" userTier="free" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/Holographic \(requires Ultimate\)/));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reflects the current selection with aria-checked', () => {
    render(<DisplayStylePicker value="floating" userTier="ultimate" onChange={() => {}} />);
    expect(screen.getByLabelText('Floating Showcase')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText('Classic Flat')).toHaveAttribute('aria-checked', 'false');
  });
});
