import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

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
});
