import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ROW = {
  id: ID, slug: 'simplesimon', name: 'SimpleSimon', avatar_url: null,
  instagram: 'https://www.instagram.com/simplesimonyoutube', youtube: null, tiktok: null, facebook: null, x: null,
};

const auth = { isAdmin: true };
const api = vi.hoisted(() => ({ fetchSavedCreators: vi.fn(), saveCreator: vi.fn(), updateCreator: vi.fn() }));
vi.mock('@/contexts/AuthContext.jsx', () => ({ useAuth: () => auth }));
vi.mock('@/lib/videoCreators.js', () => api);
vi.mock('@/utils/uploadVideoCreatorAvatar.js', () => ({
  CREATOR_AVATAR_ACCEPT: 'image/png', creatorAvatarFileError: () => null, uploadVideoCreatorAvatar: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import EventVideosEditor from '@/components/events/EventVideosEditor.jsx';

let latest;
const Harness = ({ initial }) => {
  const [value, setValue] = useState(initial);
  latest = value;
  return <EventVideosEditor value={value} onChange={setValue} />;
};
const URL_1 = 'https://www.youtube.com/watch?v=aaaaaaaaaaa';
const open = () => fireEvent.click(screen.getByRole('button', { name: /creator credit/i }));

describe('EventVideosEditor — saved creators', () => {
  beforeEach(() => {
    auth.isAdmin = true;
    api.fetchSavedCreators.mockReset().mockResolvedValue([ROW]);
    api.saveCreator.mockReset();
    api.updateCreator.mockReset();
  });

  it('fills the credit from a saved creator and links the video to them', async () => {
    render(<Harness initial={[{ title: '', url: URL_1 }]} />);
    open();
    const picker = await screen.findByLabelText('Saved creators');
    fireEvent.change(picker, { target: { value: ID } });
    expect(latest[0].creator).toMatchObject({ id: ID, slug: 'simplesimon', name: 'SimpleSimon', instagram: ROW.instagram });
    expect(screen.getByLabelText('Creator name').value).toBe('SimpleSimon');
    expect(screen.getByText('Saved creator')).toBeTruthy();
  });

  it('lets an admin save a typed credit for reuse', async () => {
    api.saveCreator.mockResolvedValue({ ...ROW, name: 'New Person', slug: 'new-person' });
    render(<Harness initial={[{ title: '', url: URL_1, creator: { name: 'New Person' } }]} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Save creator for future videos' }));
    await waitFor(() => expect(latest[0].creator.slug).toBe('new-person'));
    expect(api.saveCreator).toHaveBeenCalledWith({ name: 'New Person' });
    expect(api.fetchSavedCreators).toHaveBeenLastCalledWith({ fresh: true });
  });

  it('offers Update saved creator only once the linked credit has changed', async () => {
    api.updateCreator.mockResolvedValue({ ...ROW, name: 'Simple Simon' });
    render(<Harness initial={[{ title: '', url: URL_1, creator: { ...ROW } }]} />);
    await screen.findByLabelText('Saved creators');
    expect(screen.queryByRole('button', { name: 'Update saved creator' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Creator name'), { target: { value: 'Simple Simon' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update saved creator' }));
    await waitFor(() => expect(api.updateCreator).toHaveBeenCalledWith(ID, expect.objectContaining({ name: 'Simple Simon' })));
  });

  it('unlinks a saved creator but keeps what was typed', async () => {
    render(<Harness initial={[{ title: '', url: URL_1, creator: { ...ROW } }]} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Unlink' }));
    expect(latest[0].creator.id).toBeUndefined();
    expect(latest[0].creator.slug).toBeUndefined();
    expect(latest[0].creator.name).toBe('SimpleSimon');
  });

  it('gives a member the picker but no saving, and locks a saved creator\'s fields', async () => {
    auth.isAdmin = false;
    render(<Harness initial={[{ title: '', url: URL_1, creator: { ...ROW } }]} />);
    await screen.findByLabelText('Saved creators');
    expect(screen.getByLabelText('Creator name').disabled).toBe(true);
    expect(screen.queryByRole('button', { name: /Save creator|Update saved/ })).toBeNull();
  });

  it('still works when the saved list cannot be read', async () => {
    api.fetchSavedCreators.mockRejectedValue(new Error('no table yet'));
    render(<Harness initial={[{ title: '', url: URL_1 }]} />);
    open();
    await waitFor(() => expect(api.fetchSavedCreators).toHaveBeenCalled());
    expect(screen.queryByLabelText('Saved creators')).toBeNull();
    fireEvent.change(screen.getByLabelText('Creator name'), { target: { value: 'Typed' } });
    expect(latest[0].creator.name).toBe('Typed');
  });
});
