import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';

// The gallery only takes the image types the events bucket stores — a HEIC
// used to be accepted and then fail the whole event save at upload time.

const toastMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('sonner', () => ({ toast: toastMock }));

import EventGalleryEditor, { emptyAlbum } from '@/components/events/EventGalleryEditor.jsx';

const Harness = () => {
  const [value, setValue] = useState([emptyAlbum()]);
  return <EventGalleryEditor value={value} onChange={setValue} />;
};

describe('EventGalleryEditor — photo types', () => {
  it('skips HEIC and unsupported files with a reason, keeps the rest', () => {
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:preview');
    const { container } = render(<Harness />);
    const input = container.querySelector('input[type=file]');
    fireEvent.change(input, {
      target: {
        files: [
          new File(['x'], 'a.jpg', { type: 'image/jpeg' }),
          new File(['x'], 'b.heic', { type: 'image/heic' }),
          new File(['x'], 'c.bmp', { type: 'image/bmp' }),
          new File(['x'], 'd.png', { type: 'image/png' }),
        ],
      },
    });
    expect(toastMock.error).toHaveBeenCalledWith(expect.stringMatching(/^2 files were skipped/));
    expect(screen.getAllByRole('button', { name: /^Remove photo/ })).toHaveLength(2);
  });
});
