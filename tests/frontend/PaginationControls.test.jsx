import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PaginationControls from '@/components/PaginationControls.jsx';

describe('PaginationControls', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn();
  });

  it('scrolls back to the top when a page number is chosen', () => {
    const onPageChange = vi.fn();
    render(<PaginationControls currentPage={1} totalPages={4} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByLabelText('Page 2'));
    expect(onPageChange).toHaveBeenCalledWith(2);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('scrolls back to the top on Next and Prev', () => {
    const onPageChange = vi.fn();
    render(<PaginationControls currentPage={2} totalPages={4} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByLabelText('Next page'));
    fireEvent.click(screen.getByLabelText('Previous page'));
    expect(onPageChange.mock.calls).toEqual([[3], [1]]);
    expect(window.scrollTo).toHaveBeenCalledTimes(2);
  });
});
