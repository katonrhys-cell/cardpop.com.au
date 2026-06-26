import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockVerify = vi.hoisted(() => vi.fn());
vi.mock('@/lib/gradingVerification.js', () => ({ verifyGradingNumber: mockVerify }));

import GradingVerificationSection from '@/components/GradingVerificationSection.jsx';

beforeEach(() => vi.clearAllMocks());

describe('GradingVerificationSection — grade-match enforcement', () => {
  it('passes the claimed grade to verification', async () => {
    mockVerify.mockResolvedValue({ verified: true, company: 'psa', gradeMatch: true, verifiedGrade: '10' });
    render(<GradingVerificationSection gradingNumber="123" gradingCompany="psa" grade="PSA 10" />);
    await screen.findByText(/verified by cardpop/i);
    expect(mockVerify).toHaveBeenCalledWith('123', 'psa', 'PSA 10');
  });

  it('shows "Verified by CardPop" + grade-confirmed copy only when the grade matches', async () => {
    mockVerify.mockResolvedValue({ verified: true, company: 'psa', gradeMatch: true, verifiedGrade: '10' });
    render(<GradingVerificationSection gradingNumber="123" gradingCompany="psa" grade="10" />);
    expect(await screen.findByText(/verified by cardpop/i)).toBeInTheDocument();
    expect(screen.getByText(/listed grade matches the official record/i)).toBeInTheDocument();
  });

  it('warns on a grade mismatch and does NOT show the verified badge (the scam case)', async () => {
    mockVerify.mockResolvedValue({ verified: true, company: 'psa', gradeMatch: false, verifiedGrade: '9' });
    render(<GradingVerificationSection gradingNumber="123" gradingCompany="psa" grade="PSA 10" />);
    expect(await screen.findByText(/grade mismatch/i)).toBeInTheDocument();
    expect(screen.getByText(/records a grade of/i)).toBeInTheDocument();
    expect(screen.queryByText(/verified by cardpop/i)).not.toBeInTheDocument();
  });

  it('verifies the cert but avoids over-claiming the grade when the match is inconclusive', async () => {
    mockVerify.mockResolvedValue({ verified: true, company: 'psa', gradeMatch: null, verifiedGrade: null });
    render(<GradingVerificationSection gradingNumber="123" gradingCompany="psa" grade="Authentic" />);
    expect(await screen.findByText(/verified by cardpop/i)).toBeInTheDocument();
    expect(screen.getByText(/couldn't automatically match the listed grade/i)).toBeInTheDocument();
  });
});
