import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

vi.mock('@/lib/supabaseClient.js', () => ({ supabase: { auth: { signInWithOAuth: vi.fn(async () => ({ error: null })) } } }));

import OAuthButtons from '@/components/OAuthButtons.jsx';

describe('OAuthButtons', () => {
  it('offers Google, Apple and Facebook — and no longer GitHub', () => {
    render(<OAuthButtons redirectTo="https://cardpop.com.au/account" />);
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with apple/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with facebook/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /github/i })).toBeNull();
  });

  it('icons variant: icon-only buttons that keep their accessible names, above the divider', () => {
    render(<OAuthButtons variant="icons" dividerLabel="Or sign up with email" />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Continue with Google', 'Continue with Apple', 'Continue with Facebook',
    ]);
    buttons.forEach((b) => expect(b.textContent.trim()).toBe(''));
    const divider = screen.getByText('Or sign up with email');
    expect(buttons[2].compareDocumentPosition(divider) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('stops the spinner when the visitor comes back from the provider (bfcache restore)', async () => {
    render(<OAuthButtons variant="icons" />);
    const google = screen.getByRole('button', { name: /continue with google/i });
    fireEvent.click(google);
    // The redirect is mocked away, so the button stays "loading" and disabled.
    await waitFor(() => expect(google).toBeDisabled());
    act(() => { window.dispatchEvent(new Event('pageshow')); });
    await waitFor(() => expect(google).not.toBeDisabled());
    expect(screen.getByRole('button', { name: /continue with apple/i })).not.toBeDisabled();
  });
});

describe('OAuthButtons — providers not enabled in Supabase', () => {
  it('hides a provider the auth settings report as disabled', async () => {
    vi.resetModules();
    vi.doMock('@/lib/supabaseClient.js', () => ({
      supabase: { supabaseUrl: 'https://x.supabase.co', supabaseKey: 'k', auth: { signInWithOAuth: vi.fn() } },
    }));
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ external: { google: true, apple: false, facebook: true } }) }));
    vi.stubGlobal('fetch', fetchMock);
    const { default: Fresh } = await import('@/components/OAuthButtons.jsx');
    render(<Fresh variant="icons" />);
    await waitFor(() => expect(screen.queryByRole('button', { name: /continue with apple/i })).toBeNull());
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with facebook/i })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('https://x.supabase.co/auth/v1/settings', expect.objectContaining({ headers: { apikey: 'k' } }));
    vi.unstubAllGlobals();
  });
});
