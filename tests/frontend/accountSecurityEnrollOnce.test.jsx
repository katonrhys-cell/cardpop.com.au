import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';

// TOTPSetup must enrol exactly once: the parent passes an inline onCancel, so
// depending on it re-enrolled (and regenerated the QR) on every re-render.

const mockAuth = vi.hoisted(() => ({
  listMFAFactors: vi.fn(async () => ({ totp: [] })),
  unenrollTOTP: vi.fn(),
  enrollTOTP: vi.fn(async () => ({ id: 'f1', totp: { qr_code: 'data:image/svg+xml;utf8,<svg/>', secret: 'SECRET' } })),
  confirmTOTP: vi.fn(),
}));
// A fresh object each render, like a real context consumer re-rendering.
vi.mock('@/contexts/AuthContext.jsx', () => ({ useAuth: () => ({ ...mockAuth }) }));
vi.mock('@/components/account/AccountPageShell.jsx', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import AccountSecurity from '@/pages/account/AccountSecurity.jsx';

describe('AccountSecurity — TOTP setup', () => {
  it('enrolls once even when the parent re-renders', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<MemoryRouter><AccountSecurity /></MemoryRouter>);
    await user.click(await screen.findByRole('button', { name: /set up authenticator app/i }));
    await screen.findByText('SECRET', { exact: false });
    rerender(<MemoryRouter><AccountSecurity /></MemoryRouter>);
    rerender(<MemoryRouter><AccountSecurity /></MemoryRouter>);
    await screen.findByText('SECRET', { exact: false });
    expect(mockAuth.enrollTOTP).toHaveBeenCalledTimes(1);
  });
});
