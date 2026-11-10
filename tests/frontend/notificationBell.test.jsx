import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const markRead = vi.fn();
vi.mock('@/hooks/useNotifications.js', () => ({
  useNotifications: () => ({
    notifications: [{
      id: 'n1', type: 'offer_received', title: 'New offer on your card',
      body: null, is_read: false, created_at: new Date().toISOString(), link: '/account/offers',
    }],
    unreadCount: 1,
    loading: false,
    markRead,
    markAllRead: vi.fn(),
  }),
}));

import NotificationBell from '@/components/NotificationBell.jsx';

describe('NotificationBell', () => {
  it('opens the panel, and closes it when a notification is tapped', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><NotificationBell /></MemoryRouter>);

    const bell = screen.getByRole('button', { name: /notifications, 1 unread/i });
    await user.click(bell);
    const item = await screen.findByText('New offer on your card');
    // Panel is sized to the viewport so it can't hang off a phone screen.
    expect(item.closest('[data-radix-popper-content-wrapper] > *').className)
      .toContain('calc(100vw-1.5rem)');

    await user.click(item);
    expect(markRead).toHaveBeenCalledWith('n1');
    await waitFor(() => expect(screen.queryByText('New offer on your card')).toBeNull());
  });

  it('is not hidden on phones in the header', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../../components/Header.jsx'), 'utf8');
    const at = src.indexOf('<NotificationBell />');
    const before = src.slice(Math.max(0, at - 300), at);
    expect(before).not.toMatch(/hidden sm:/);
  });
});
