import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import UploadErrorDialog from '@/components/account/UploadErrorDialog.jsx';
import { describeUploadError } from '@/utils/storageUploadError.js';

const rlsError = { message: 'new row violates row-level security policy', statusCode: '403' };

describe('UploadErrorDialog', () => {
  it('renders nothing when there is no error', () => {
    render(<UploadErrorDialog error={null} onClose={() => {}} />);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('shows the explanation as a modal the user must dismiss', () => {
    const onClose = vi.fn();
    const error = describeUploadError(rlsError, { what: 'profile photo' });
    render(<UploadErrorDialog error={error} onClose={onClose} />);

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent("Your profile photo couldn't be saved");
    expect(dialog).toHaveTextContent('permissions problem on our side');
    expect(dialog).toHaveTextContent('new row violates row-level security policy');

    fireEvent.click(screen.getByRole('button', { name: /got it/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
