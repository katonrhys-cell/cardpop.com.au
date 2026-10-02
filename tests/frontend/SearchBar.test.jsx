import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SearchBar from '@/components/SearchBar.jsx';

const renderBar = (props = {}) =>
  render(
    <MemoryRouter>
      <SearchBar {...props} />
    </MemoryRouter>,
  );

describe('SearchBar', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ suggestions: ['Pikachu VMAX', 'Pikachu ex'] }),
    });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const flush = async () => {
    await act(async () => { vi.advanceTimersByTime(350); });
    await act(async () => {});
  };

  it('shows suggestions while typing in the focused box', async () => {
    renderBar({ onSearchChange: vi.fn() });
    const input = screen.getByRole('searchbox');
    input.focus();
    fireEvent.change(input, { target: { value: 'pika' } });
    await flush();
    expect(screen.getByText('Pikachu VMAX')).toBeTruthy();
  });

  it('does not re-open the dropdown after a suggestion is chosen', async () => {
    const onSearchChange = vi.fn();
    renderBar({ onSearchChange });
    const input = screen.getByRole('searchbox');
    input.focus();
    fireEvent.change(input, { target: { value: 'pika' } });
    await flush();
    fireEvent.click(screen.getByText('Pikachu VMAX'));
    expect(onSearchChange).toHaveBeenCalledWith('Pikachu VMAX');
    // The query change re-runs the debounced fetch; its result must not pop
    // the list back open now the user has left the box.
    await flush();
    expect(screen.queryByText('Pikachu ex')).toBeNull();
  });

  it('does not open recent searches on page load, only on focus', async () => {
    localStorage.setItem('cardpop_search_history', JSON.stringify(['charizard']));
    renderBar({ onSearchChange: vi.fn() });
    await flush();
    expect(screen.queryByText('Recent Searches')).toBeNull();
  });

  it('labels the clear button', () => {
    renderBar({ initialQuery: 'abc', onSearchChange: vi.fn() });
    expect(screen.getByRole('button', { name: 'Clear search' })).toBeTruthy();
  });
});
