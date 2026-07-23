import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import WizardStepper from '@/components/WizardStepper.jsx';

const STEPS = [
  { key: 'photos', title: 'Photos' },
  { key: 'details', title: 'Details' },
  { key: 'value', title: 'Value' },
  { key: 'publish', title: 'List it' },
];

const renderStepper = (props = {}) =>
  render(
    <WizardStepper steps={STEPS} current={1} maxReached={1} onStepSelect={() => {}} {...props} />
  );

describe('WizardStepper', () => {
  it('renders a button per step', () => {
    renderStepper();
    expect(screen.getAllByRole('button')).toHaveLength(STEPS.length);
  });

  it('marks the current step with aria-current', () => {
    renderStepper({ current: 2, maxReached: 2 });
    const current = screen.getByRole('button', { current: 'step' });
    expect(current).toHaveTextContent('Value');
  });

  it('disables steps beyond maxReached', () => {
    renderStepper({ current: 0, maxReached: 0 });
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toBeEnabled();
    expect(buttons[1]).toBeDisabled();
    expect(buttons[3]).toBeDisabled();
  });

  it('navigates to reached steps on click', () => {
    const onStepSelect = vi.fn();
    renderStepper({ current: 2, maxReached: 3, onStepSelect });
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(onStepSelect).toHaveBeenCalledWith(0);
    fireEvent.click(screen.getAllByRole('button')[3]);
    expect(onStepSelect).toHaveBeenCalledWith(3);
  });

  it('does not navigate to unreached steps', () => {
    const onStepSelect = vi.fn();
    renderStepper({ current: 1, maxReached: 1, onStepSelect });
    fireEvent.click(screen.getAllByRole('button')[3]);
    expect(onStepSelect).not.toHaveBeenCalled();
  });
});
