import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockVerify = vi.hoisted(() => vi.fn());
const mockFetch = vi.hoisted(() => vi.fn());
vi.mock('@/lib/gradingVerification.js', () => ({ verifyGradingNumber: mockVerify }));
vi.mock('@/lib/apiServerClient.js', () => ({ default: { fetch: mockFetch } }));

import CertificationVerificationSection from '@/components/CertificationVerificationSection.jsx';

beforeEach(() => {
  vi.clearAllMocks();
  // Default: PSA detail lookup finds nothing so verification alone drives status.
  mockFetch.mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
});

describe('CertificationVerificationSection — grade-match enforcement', () => {
  it('passes the claimed grade to verification', async () => {
    mockVerify.mockResolvedValue({ verified: true, company: 'psa', gradeMatch: true, verifiedGrade: '10' });
    render(<CertificationVerificationSection certNumber="123" gradingCompany="psa" grade="PSA 10" />);
    await screen.findByText(/verified by cardpop/i);
    expect(mockVerify).toHaveBeenCalledWith('123', 'psa', 'PSA 10');
  });

  it('shows "Verified by CardPop" + grade-confirmed copy only when the grade matches', async () => {
    mockVerify.mockResolvedValue({ verified: true, company: 'psa', gradeMatch: true, verifiedGrade: '10' });
    render(<CertificationVerificationSection certNumber="123" gradingCompany="psa" grade="10" />);
    expect(await screen.findByText(/verified by cardpop/i)).toBeInTheDocument();
    expect(screen.getByText(/listed grade matches the official record/i)).toBeInTheDocument();
  });

  it('warns on a grade mismatch and does NOT show the verified badge (the scam case)', async () => {
    mockVerify.mockResolvedValue({ verified: true, company: 'psa', gradeMatch: false, verifiedGrade: '9' });
    render(<CertificationVerificationSection certNumber="123" gradingCompany="psa" grade="PSA 10" />);
    expect(await screen.findByText(/grade mismatch/i)).toBeInTheDocument();
    expect(screen.getByText(/records a grade of/i)).toBeInTheDocument();
    expect(screen.queryByText(/verified by cardpop/i)).not.toBeInTheDocument();
  });

  it('verifies the cert but avoids over-claiming the grade when the match is inconclusive', async () => {
    mockVerify.mockResolvedValue({ verified: true, company: 'psa', gradeMatch: null, verifiedGrade: null });
    render(<CertificationVerificationSection certNumber="123" gradingCompany="psa" grade="Authentic" />);
    expect(await screen.findByText(/verified by cardpop/i)).toBeInTheDocument();
    expect(screen.getByText(/couldn't automatically match the listed grade/i)).toBeInTheDocument();
  });
});

describe('CertificationVerificationSection — merged PSA details', () => {
  it('renders full PSA certificate details in the same section as the verification status', async () => {
    mockVerify.mockResolvedValue({ verified: true, company: 'psa', gradeMatch: true, verifiedGrade: '9' });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        certNumber: '100139988',
        cardTitle: '2023 Pokemon Charizard',
        cardYear: '2023',
        cardNumber: '220',
        grade: 9,
        population: 1200,
        popHigher: 648,
      }),
    });
    render(<CertificationVerificationSection certNumber="100139988" gradingCompany="psa" grade="9" />);
    expect(await screen.findByText(/verified by cardpop/i)).toBeInTheDocument();
    expect(screen.getByText('2023 Pokemon Charizard')).toBeInTheDocument();
    expect(screen.getByText('#220')).toBeInTheDocument();
    expect(screen.getByText('648')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /verify on psa website/i }))
      .toHaveAttribute('href', 'https://www.psacard.com/cert/100139988');
    // One unified section — the old standalone PSA card heading must be gone.
    expect(screen.queryByText(/psa certification verification/i)).not.toBeInTheDocument();
  });

  it('renders the PSA card images and the full record detail rows', async () => {
    mockVerify.mockResolvedValue({ verified: true, company: 'psa', gradeMatch: true, verifiedGrade: '10' });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        certNumber: '138138870',
        cardTitle: '1999 Pokemon Game Charizard #4',
        cardYear: '1999',
        cardSet: 'Pokemon Game',
        cardNumber: '4',
        grade: 10,
        subject: 'Charizard-Holo',
        category: 'TCG Cards',
        variety: '1st Edition',
        labelType: 'Standard Holographic',
        frontImage: 'https://images.psacard.com/cert/138138870/front.jpg',
        backImage: 'https://images.psacard.com/cert/138138870/back.jpg',
      }),
    });
    render(<CertificationVerificationSection certNumber="138138870" gradingCompany="psa" grade="10" />);
    await screen.findByText(/verified by cardpop/i);

    // Detail rows (label + value) all render.
    expect(screen.getByText('Subject')).toBeInTheDocument();
    expect(screen.getByText('Charizard-Holo')).toBeInTheDocument();
    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.getByText('TCG Cards')).toBeInTheDocument();
    expect(screen.getByText('Label Type')).toBeInTheDocument();
    expect(screen.getByText('Standard Holographic')).toBeInTheDocument();
    expect(screen.getByText('Pokemon Game')).toBeInTheDocument();

    // Card images come through from PSA and render with correct sources.
    const front = screen.getByAltText('Card Front');
    const back = screen.getByAltText('Card Back');
    expect(front).toHaveAttribute('src', 'https://images.psacard.com/cert/138138870/front.jpg');
    expect(back).toHaveAttribute('src', 'https://images.psacard.com/cert/138138870/back.jpg');
  });

  it('falls back to the PSA detail lookup when the verification endpoint fails', async () => {
    mockVerify.mockRejectedValue(new Error('network down'));
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ certNumber: '123', grade: 9 }),
    });
    render(<CertificationVerificationSection certNumber="123" gradingCompany="psa" grade="9" />);
    // The cert clearly exists — no contradictory "Verification error".
    expect(await screen.findByText(/verified by cardpop/i)).toBeInTheDocument();
    expect(screen.queryByText(/verification error/i)).not.toBeInTheDocument();
  });

  it('flags a grade mismatch from the PSA details when verification is unavailable', async () => {
    mockVerify.mockRejectedValue(new Error('network down'));
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ certNumber: '123', grade: 9 }),
    });
    render(<CertificationVerificationSection certNumber="123" gradingCompany="psa" grade="PSA 10" />);
    expect(await screen.findByText(/grade mismatch/i)).toBeInTheDocument();
    expect(screen.queryByText(/verified by cardpop/i)).not.toBeInTheDocument();
  });

  it('shows a single verification error when both lookups fail', async () => {
    mockVerify.mockRejectedValue(new Error('network down'));
    mockFetch.mockRejectedValue(new Error('network down'));
    render(<CertificationVerificationSection certNumber="123" gradingCompany="psa" grade="9" />);
    expect(await screen.findByText(/verification error/i)).toBeInTheDocument();
    expect(screen.getByText(/couldn't reach the psa database/i)).toBeInTheDocument();
    expect(screen.queryByText(/verified by cardpop/i)).not.toBeInTheDocument();
  });
});
