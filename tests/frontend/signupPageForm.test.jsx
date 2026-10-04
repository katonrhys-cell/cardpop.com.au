import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const signup = vi.fn(async () => ({ success: true }));
vi.mock('@/contexts/AuthContext.jsx', () => ({ useAuth: () => ({ signup }) }));
vi.mock('@/lib/supabaseClient.js', () => ({ supabase: { auth: { signInWithOAuth: vi.fn() } } }));
vi.mock('@/lib/turnstile.js', () => ({ TURNSTILE_ENABLED: false }));
vi.mock('@/components/Turnstile.jsx', () => ({ default: () => null }));
vi.mock('@/utils/pwnedPassword.js', () => ({ isPasswordPwned: vi.fn(async () => false) }));
vi.mock('@/lib/apiServerClient.js', () => ({ default: { fetch: vi.fn(async () => ({ ok: true, json: async () => ({}) })) } }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

import SignupPage from '@/pages/SignupPage.jsx';

const renderPage = () => render(<MemoryRouter initialEntries={['/signup']}><SignupPage /></MemoryRouter>);

beforeEach(() => signup.mockClear());

describe('SignupPage — the shorter form', () => {
  it('asks for one password (no confirm field) and only requires 8 characters', () => {
    renderPage();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/confirm password/i)).toBeNull();
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(screen.queryByText(/one uppercase letter/i)).toBeNull();
  });

  it('leaves the newsletter box unticked and shows the terms as a checkbox with links', () => {
    renderPage();
    const boxes = screen.getAllByRole('checkbox');
    const newsletter = boxes.find((b) => /newsletter|tips|deals|updates/i.test(b.closest('label')?.textContent || ''));
    expect(newsletter?.checked ?? false).toBe(false);
    expect(screen.getByRole('link', { name: /terms of service/i })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: /privacy policy/i })).toHaveAttribute('href', '/privacy');
    expect(screen.queryByText(/scroll to the bottom/i)).toBeNull();
  });

  it('enables submit once name, email, an 8+ character password and the terms box are filled', () => {
    renderPage();
    const submit = screen.getByRole('button', { name: /create secure account/i });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Ash' } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Ketchum' } });
    fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: 'ash@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'pikachu1' } });
    const terms = screen.getAllByRole('checkbox').find((b) => /terms of service/i.test(b.closest('label')?.textContent || ''));
    fireEvent.click(terms);
    expect(submit).not.toBeDisabled();
  });
});
