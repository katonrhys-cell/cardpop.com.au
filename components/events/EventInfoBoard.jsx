import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import {
  EVENT_ROLE_LABELS,
  fetchCanManageBoard,
  fetchParticipantRoles,
  sortBoardPosts,
  sortStalls,
  clampStallPosition,
} from '@/lib/eventBoard.js';
import { publicImageUrl } from '@/utils/imageUrl.js';
import { compressImage } from '@/utils/compressImage.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { ClipboardList, Pin, PinOff, Trash2, Map, Store, Pencil, Loader2, ImagePlus, X } from 'lucide-react';

const timeAgo = (iso) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const EMPTY_STALL_FORM = { label: '', name: '', description: '', pos_x: '', pos_y: '' };

// Per-event information board: pinned announcements, the venue's stall layout
// image and a structured stall list. Announcements and layout edits are open
// to admins, the event's organiser and vendors RSVP'd to the event (enforced
// by RLS via can_manage_event_board); everything is publicly readable.
//
// Stalls carry optional pos_x/pos_y percentages on the layout image. Placed
// stalls render as numbered markers over the image today; the same data is
// the basis for the planned fully interactive, clickable floor plan.
const EventInfoBoard = ({ event }) => {
  const eventId = event?.id;
  // Admin status lives on profiles.is_admin (exposed as isAdmin by AuthContext);
  // the Supabase user's `role` is always 'authenticated', so checking it never matched.
  const { currentUser, isAuthenticated, isAdmin } = useAuth();

  const [loading, setLoading] = useState(true);
  const [boardPosts, setBoardPosts] = useState([]);
  const [layout, setLayout] = useState(null);
  const [stalls, setStalls] = useState([]);
  const [roles, setRoles] = useState({});
  const [canManage, setCanManage] = useState(false);

  // Announcement composer
  const [showComposer, setShowComposer] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeBody, setNoticeBody] = useState('');
  const [noticePinned, setNoticePinned] = useState(false);
  const [savingNotice, setSavingNotice] = useState(false);

  // Layout management
  const fileInputRef = useRef(null);
  const [uploadingLayout, setUploadingLayout] = useState(false);
  const [stallForm, setStallForm] = useState(EMPTY_STALL_FORM);
  const [editingStallId, setEditingStallId] = useState(null);
  const [savingStall, setSavingStall] = useState(false);
  const [selectedStallId, setSelectedStallId] = useState(null);

  const load = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const [postsRes, layoutRes, stallsRes] = await Promise.all([
        supabase
          .from('event_board_posts')
          .select('*, profiles:author_id(id, display_name, username)')
          .eq('event_id', eventId)
          .eq('is_visible', true),
        supabase.from('event_stall_layouts').select('*').eq('event_id', eventId).maybeSingle(),
        supabase.from('event_stalls').select('*').eq('event_id', eventId),
      ]);
      if (postsRes.error) throw postsRes.error;
      if (layoutRes.error) throw layoutRes.error;
      if (stallsRes.error) throw stallsRes.error;
      const posts = sortBoardPosts(postsRes.data || []);
      setBoardPosts(posts);
      setLayout(layoutRes.data || null);
      setStalls(sortStalls(stallsRes.data || []));
      const authorIds = posts.map((p) => p.author_id);
      if (authorIds.length > 0) {
        try {
          setRoles(await fetchParticipantRoles(eventId, authorIds));
        } catch {
          setRoles({});
        }
      }
    } catch (err) {
      console.error('Failed to load event information board:', err);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let cancelled = false;
    if (!eventId || !isAuthenticated) { setCanManage(false); return undefined; }
    fetchCanManageBoard(eventId)
      .then((allowed) => { if (!cancelled) setCanManage(allowed); })
      .catch(() => { if (!cancelled) setCanManage(false); });
    return () => { cancelled = true; };
  }, [eventId, isAuthenticated]);

  const handlePostNotice = async (e) => {
    e.preventDefault();
    const body = noticeBody.trim();
    if (body.length < 5) { toast.error('Add a bit more detail to your announcement.'); return; }
    setSavingNotice(true);
    try {
      const { error } = await supabase.from('event_board_posts').insert({
        event_id: eventId,
        author_id: currentUser.id,
        title: noticeTitle.trim() || null,
        body,
        is_pinned: noticePinned,
      });
      if (error) throw error;
      toast.success('Posted to the information board!');
      setNoticeTitle('');
      setNoticeBody('');
      setNoticePinned(false);
      setShowComposer(false);
      load();
    } catch (err) {
      toast.error(err.message || 'Failed to post. Please try again.');
    } finally {
      setSavingNotice(false);
    }
  };

  const handleTogglePin = async (post) => {
    try {
      const { error } = await supabase
        .from('event_board_posts')
        .update({ is_pinned: !post.is_pinned })
        .eq('id', post.id);
      if (error) throw error;
      load();
    } catch (err) {
      toast.error(err.message || 'Could not update the announcement.');
    }
  };

  const handleDeleteNotice = async (post) => {
    try {
      const { error } = await supabase.from('event_board_posts').delete().eq('id', post.id);
      if (error) throw error;
      toast('Announcement removed');
      load();
    } catch (err) {
      toast.error(err.message || 'Could not remove the announcement.');
    }
  };

  const handleLayoutUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLayout(true);
    try {
      const compressed = await compressImage(file);
      const ext = compressed.name.split('.').pop() || 'jpg';
      // Timestamped path: layout images are immutable uploads (see image-cdn
      // docs) — replacing the plan uploads a new object and repoints the row.
      const path = `layouts/${eventId}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('events').upload(path, compressed, { cacheControl: '31536000' });
      if (upErr) throw upErr;
      const image_url = supabase.storage.from('events').getPublicUrl(path).data.publicUrl;
      const { error } = await supabase
        .from('event_stall_layouts')
        .upsert({ event_id: eventId, image_url, updated_by: currentUser.id }, { onConflict: 'event_id' });
      if (error) throw error;
      toast.success('Stall layout updated!');
      load();
    } catch (err) {
      toast.error(err.message || 'Failed to upload the layout image.');
    } finally {
      setUploadingLayout(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const startEditStall = (stall) => {
    setEditingStallId(stall.id);
    setStallForm({
      label: stall.label || '',
      name: stall.name || '',
      description: stall.description || '',
      pos_x: stall.pos_x ?? '',
      pos_y: stall.pos_y ?? '',
    });
  };

  const resetStallForm = () => {
    setEditingStallId(null);
    setStallForm(EMPTY_STALL_FORM);
  };

  const handleSaveStall = async (e) => {
    e.preventDefault();
    const label = stallForm.label.trim();
    if (!label) { toast.error('Give the stall a number or label.'); return; }
    setSavingStall(true);
    try {
      const payload = {
        label,
        name: stallForm.name.trim() || null,
        description: stallForm.description.trim() || null,
        pos_x: clampStallPosition(stallForm.pos_x),
        pos_y: clampStallPosition(stallForm.pos_y),
      };
      const { error } = editingStallId
        ? await supabase.from('event_stalls').update(payload).eq('id', editingStallId)
        : await supabase.from('event_stalls').insert({ ...payload, event_id: eventId });
      if (error) throw error;
      toast.success(editingStallId ? 'Stall updated' : 'Stall added');
      resetStallForm();
      load();
    } catch (err) {
      toast.error(err.message || 'Could not save the stall.');
    } finally {
      setSavingStall(false);
    }
  };

  const handleDeleteStall = async (stall) => {
    try {
      const { error } = await supabase.from('event_stalls').delete().eq('id', stall.id);
      if (error) throw error;
      if (editingStallId === stall.id) resetStallForm();
      toast('Stall removed');
      load();
    } catch (err) {
      toast.error(err.message || 'Could not remove the stall.');
    }
  };

  const placedStalls = stalls.filter((s) => s.pos_x != null && s.pos_y != null);

  if (loading) {
    return (
      <section className="mt-10 space-y-4">
        <Skeleton className="h-8 w-64 rounded-xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </section>
    );
  }

  const hasContent = boardPosts.length > 0 || layout?.image_url || stalls.length > 0;
  // Nothing posted and nobody signed in who could post — keep the page clean.
  if (!hasContent && !canManage) return null;

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between gap-3 mb-5">
        <h2 className="text-2xl font-bold font-serif flex items-center gap-2.5">
          <ClipboardList className="w-6 h-6 text-primary" /> Information Board
        </h2>
        {canManage && !showComposer && (
          <Button onClick={() => setShowComposer(true)} variant="outline" className="rounded-xl font-bold gap-2">
            <Pin className="w-4 h-4" /> Post Announcement
          </Button>
        )}
      </div>

      {canManage && showComposer && (
        <form onSubmit={handlePostNotice} className="bg-card border border-border rounded-2xl p-5 mb-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-bold text-sm">New announcement</p>
            <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setShowComposer(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <Input
            value={noticeTitle}
            onChange={(e) => setNoticeTitle(e.target.value)}
            placeholder="Title (optional)"
            maxLength={140}
            className="rounded-xl"
          />
          <Textarea
            value={noticeBody}
            onChange={(e) => setNoticeBody(e.target.value)}
            placeholder="Share updates with vendors and show-goers — trading hours, parking, table allocations…"
            maxLength={3000}
            rows={4}
            className="rounded-xl"
          />
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <Checkbox checked={noticePinned} onCheckedChange={(v) => setNoticePinned(v === true)} />
              Pin to top
            </label>
            <Button type="submit" className="rounded-xl font-bold" disabled={savingNotice || !noticeBody.trim()}>
              {savingNotice ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Post'}
            </Button>
          </div>
        </form>
      )}

      {boardPosts.length > 0 && (
        <div className="space-y-3 mb-8">
          {boardPosts.map((post) => {
            const role = roles[post.author_id];
            const mine = currentUser?.id === post.author_id;
            return (
              <div key={post.id} className={`bg-card border rounded-2xl p-5 ${post.is_pinned ? 'border-primary/40' : 'border-border'}`}>
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {post.is_pinned && <Pin className="w-4 h-4 text-primary shrink-0" />}
                    {post.title && <h3 className="font-bold leading-snug">{post.title}</h3>}
                  </div>
                  {(mine || isAdmin) && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground" title={post.is_pinned ? 'Unpin' : 'Pin to top'} onClick={() => handleTogglePin(post)}>
                        {post.is_pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" title="Delete" onClick={() => handleDeleteNotice(post)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-line mb-3">{post.body}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium">{post.profiles?.display_name || post.profiles?.username || 'Collector'}</span>
                  {role && (
                    <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wide">
                      {EVENT_ROLE_LABELS[role]}
                    </Badge>
                  )}
                  <span>·</span>
                  <span>{timeAgo(post.created_at)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(layout?.image_url || stalls.length > 0 || canManage) && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="font-bold flex items-center gap-2">
              <Map className="w-5 h-5 text-primary" /> Stall Layout
            </h3>
            {canManage && (
              <>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLayoutUpload} />
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl font-bold gap-2"
                  disabled={uploadingLayout}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadingLayout ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                  {layout?.image_url ? 'Replace floor plan' : 'Upload floor plan'}
                </Button>
              </>
            )}
          </div>

          {layout?.image_url ? (
            <div className="relative rounded-xl overflow-hidden border border-border mb-4">
              <img
                src={publicImageUrl(layout.image_url, 'events')}
                alt={`Stall layout for ${event?.title || 'this event'}`}
                className="w-full h-auto block"
              />
              {/* Placed stalls render as numbered markers — the first step
                  towards the fully clickable floor plan. */}
              {placedStalls.map((stall) => (
                <button
                  key={stall.id}
                  type="button"
                  title={[stall.label, stall.name].filter(Boolean).join(' — ')}
                  onClick={() => setSelectedStallId(stall.id === selectedStallId ? null : stall.id)}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 min-w-6 h-6 px-1.5 rounded-full text-[11px] font-bold shadow-md border-2 border-white transition-transform hover:scale-110 ${
                    selectedStallId === stall.id ? 'bg-primary text-primary-foreground scale-110' : 'bg-brand-charcoal text-white'
                  }`}
                  style={{ left: `${stall.pos_x}%`, top: `${stall.pos_y}%` }}
                >
                  {stall.label}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mb-4">
              {canManage
                ? 'No floor plan yet — upload an image of the venue layout so show-goers can find every stall.'
                : 'The organiser hasn’t shared a floor plan for this event yet.'}
            </p>
          )}

          {stalls.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="py-2 pr-3 font-semibold">Stall</th>
                    <th className="py-2 pr-3 font-semibold">Vendor / Name</th>
                    <th className="py-2 pr-3 font-semibold">Details</th>
                    {canManage && <th className="py-2 w-20" aria-label="Actions" />}
                  </tr>
                </thead>
                <tbody>
                  {stalls.map((stall) => (
                    <tr
                      key={stall.id}
                      className={`border-b border-border/60 last:border-0 ${selectedStallId === stall.id ? 'bg-primary/5' : ''}`}
                      onClick={() => setSelectedStallId(stall.id === selectedStallId ? null : stall.id)}
                    >
                      <td className="py-2.5 pr-3 font-bold whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <Store className="w-3.5 h-3.5 text-primary" /> {stall.label}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3">{stall.name || <span className="text-muted-foreground">—</span>}</td>
                      <td className="py-2.5 pr-3 text-muted-foreground">{stall.description || '—'}</td>
                      {canManage && (
                        <td className="py-2.5">
                          <div className="flex items-center gap-1 justify-end">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" title="Edit stall" onClick={(e) => { e.stopPropagation(); startEditStall(stall); }}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" title="Remove stall" onClick={(e) => { e.stopPropagation(); handleDeleteStall(stall); }}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {canManage && (
            <form onSubmit={handleSaveStall} className="mt-4 pt-4 border-t border-border space-y-3">
              <p className="font-bold text-sm">{editingStallId ? 'Edit stall' : 'Add a stall'}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold">Stall number / label</Label>
                  <Input value={stallForm.label} onChange={(e) => setStallForm((f) => ({ ...f, label: e.target.value }))} placeholder="e.g. 12 or A4" maxLength={30} className="rounded-xl" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold">Vendor / business name</Label>
                  <Input value={stallForm.name} onChange={(e) => setStallForm((f) => ({ ...f, name: e.target.value }))} placeholder="Who's at this stall? (optional)" maxLength={100} className="rounded-xl" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold">Details</Label>
                <Input value={stallForm.description} onChange={(e) => setStallForm((f) => ({ ...f, description: e.target.value }))} placeholder="What they sell, deals, etc. (optional)" maxLength={200} className="rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-3 max-w-xs">
                <div className="space-y-1">
                  <Label className="text-xs font-bold">Map position X (%)</Label>
                  <Input type="number" min="0" max="100" step="0.5" value={stallForm.pos_x} onChange={(e) => setStallForm((f) => ({ ...f, pos_x: e.target.value }))} placeholder="0–100" className="rounded-xl" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold">Map position Y (%)</Label>
                  <Input type="number" min="0" max="100" step="0.5" value={stallForm.pos_y} onChange={(e) => setStallForm((f) => ({ ...f, pos_y: e.target.value }))} placeholder="0–100" className="rounded-xl" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Positions place the stall's marker on the floor plan (left/top as a percentage of the image). Leave blank to list the stall without a marker.
              </p>
              <div className="flex items-center gap-2">
                <Button type="submit" size="sm" className="rounded-xl font-bold" disabled={savingStall || !stallForm.label.trim()}>
                  {savingStall ? <Loader2 className="w-4 h-4 animate-spin" /> : editingStallId ? 'Save changes' : 'Add stall'}
                </Button>
                {editingStallId && (
                  <Button type="button" size="sm" variant="outline" className="rounded-xl font-bold" onClick={resetStallForm}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          )}
        </div>
      )}
    </section>
  );
};

export default EventInfoBoard;
