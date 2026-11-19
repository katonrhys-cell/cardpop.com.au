import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, BookmarkCheck, BookmarkPlus, CheckCircle2, AlertCircle, ChevronDown, Loader2, Plus, Trash2, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  MAX_EVENT_VIDEOS,
  MAX_VIDEO_TITLE_CHARS,
  MAX_CREATOR_NAME_CHARS,
  CREATOR_PLATFORMS,
  cleanVideoCreator,
  creatorProfileUrl,
  emptyVideo,
  youTubeVideoId,
  youTubeThumbnailUrl,
} from '@/utils/eventVideos.js';
import { CREATOR_AVATAR_ACCEPT, creatorAvatarFileError, uploadVideoCreatorAvatar } from '@/utils/uploadVideoCreatorAvatar.js';
import VideoCreatorCredit from '@/components/events/VideoCreatorCredit.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { fetchSavedCreators, saveCreator, updateCreator } from '@/lib/videoCreators.js';
import { creatorRowToCredit, creditDiffersFromSaved, creditToCreatorRow, savedCreatorLabel, videoCreatorPath } from '@/utils/videoCreators.js';

// Video list for the event form. Controlled: `value` is [{ title, url, creator? }] in
// display order; the form normalises it with cleanEventVideos on save. The
// event page embeds them below the photo gallery
// (components/events/EventVideos.jsx) and starts the first one by itself.
// The creator credit for one video: picture, name and social handles, shown
// under the player on the page. The picture uploads as soon as it is picked
// (the row then just holds its URL); socials take a handle or a pasted link
// and are checked against that platform as they are typed.
//
// Saved creators (public.video_creators): anyone filling in the form can pick
// one from the list, which fills the credit and links the video to that
// creator's page. Admins save a new one from what they typed, and update a
// saved one — the database then changes every video that credits them. For a
// member the fields of a saved creator are read-only (they can pick another or
// unlink and type their own).
const CreatorFields = ({ video, n, onChange, disabled, savedCreators, isAdmin, onSavedChange }) => {
  const creator = video.creator || {};
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (key, value) => onChange({ ...video, creator: { ...creator, [key]: value } });

  const linkedId = creator.id || '';
  const savedRow = linkedId ? savedCreators.find((c) => c.id === linkedId) : null;
  const locked = disabled || (Boolean(linkedId) && !isAdmin);
  const canSaveNew = isAdmin && !linkedId && Boolean(creditToCreatorRow(creator));
  const canUpdate = isAdmin && Boolean(savedRow) && Boolean(creditToCreatorRow(creator)) && creditDiffersFromSaved(creator, savedRow);

  const pickSaved = (id) => {
    const row = savedCreators.find((c) => c.id === id);
    if (row) onChange({ ...video, creator: creatorRowToCredit(row) });
  };
  const unlink = () => {
    const { id: _id, slug: _slug, ...rest } = creator;
    onChange({ ...video, creator: rest });
  };
  const saveNew = async () => {
    setSaving(true);
    try {
      const row = await saveCreator(creator);
      onChange({ ...video, creator: creatorRowToCredit(row) });
      await onSavedChange();
      toast.success(`${row.name} is saved — pick them from “Saved creators” on any video. Save the event to keep this video linked.`);
    } catch (err) {
      toast.error(`The creator wasn't saved — ${err?.message || 'please try again'}.`);
    } finally {
      setSaving(false);
    }
  };
  const updateSaved = async () => {
    setSaving(true);
    try {
      const row = await updateCreator(linkedId, creator);
      onChange({ ...video, creator: creatorRowToCredit(row) });
      await onSavedChange();
      toast.success(`${row.name} is updated on every video that credits them.`);
    } catch (err) {
      toast.error(`The creator wasn't updated — ${err?.message || 'please try again'}.`);
    } finally {
      setSaving(false);
    }
  };

  const pickAvatar = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const problem = creatorAvatarFileError(file);
    if (problem) { toast.error(problem); return; }
    setUploading(true);
    try {
      set('avatar_url', await uploadVideoCreatorAvatar(file));
    } catch (err) {
      toast.error(`The picture didn't upload — ${err?.message || 'please try again'}.`);
    } finally {
      setUploading(false);
    }
  };

  const preview = cleanVideoCreator(creator);

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <p className="text-xs text-muted-foreground">
        Credit whoever made this video. Their picture, name and handles show under the video on the page.
      </p>
      {savedCreators.length > 0 && (
        <div className="space-y-1">
          <Label htmlFor={`video-creator-saved-${n}`} className="text-xs">Saved creators</Label>
          <select
            id={`video-creator-saved-${n}`}
            value={savedRow ? linkedId : ''}
            onChange={(e) => pickSaved(e.target.value)}
            disabled={disabled}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">Choose a saved creator…</option>
            {savedCreators.map((c) => <option key={c.id} value={c.id}>{savedCreatorLabel(c)}</option>)}
          </select>
        </div>
      )}
      {linkedId && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-background px-3 py-2 text-xs">
          <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
            <BookmarkCheck className="h-3.5 w-3.5 text-brand-red" aria-hidden="true" /> Saved creator
          </span>
          <span className="text-muted-foreground">
            This video will be listed on{' '}
            <a href={videoCreatorPath(creator)} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-brand-red">their page</a>
            {isAdmin ? '. Changes you make here only reach their other videos once you press Update saved creator.' : '. Unlink to type different details.'}
          </span>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={disabled} onClick={unlink}>Unlink</Button>
        </div>
      )}
      <div className="flex items-center gap-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-border bg-muted flex items-center justify-center">
          {uploading
            ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" aria-label="Uploading picture" />
            : creator.avatar_url
              ? <img src={creator.avatar_url} alt="" className="h-full w-full object-cover" />
              : <UserRound className="w-6 h-6 text-muted-foreground" aria-hidden="true" />}
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept={CREATOR_AVATAR_ACCEPT} className="hidden" onChange={pickAvatar}
            aria-label={`Video ${n} creator picture`} />
          <Button type="button" variant="outline" size="sm" disabled={locked || uploading} onClick={() => fileRef.current?.click()}>
            {creator.avatar_url ? 'Change picture' : 'Upload picture'}
          </Button>
          {creator.avatar_url && (
            <Button type="button" variant="ghost" size="sm" disabled={locked || uploading} onClick={() => set('avatar_url', '')}>
              Remove
            </Button>
          )}
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`video-creator-name-${n}`} className="text-xs">Creator name</Label>
        <Input
          id={`video-creator-name-${n}`}
          value={creator.name || ''}
          onChange={(e) => set('name', e.target.value.slice(0, MAX_CREATOR_NAME_CHARS))}
          placeholder="e.g. Simple Simon"
          maxLength={MAX_CREATOR_NAME_CHARS}
          disabled={locked}
          className="h-9"
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {CREATOR_PLATFORMS.map(({ key, label, placeholder }) => {
          const typed = (creator[key] || '').trim();
          const invalid = Boolean(typed) && !creatorProfileUrl(key, typed);
          return (
            <div key={key} className="space-y-1">
              <Label htmlFor={`video-creator-${key}-${n}`} className="text-xs">{label}</Label>
              <Input
                id={`video-creator-${key}-${n}`}
                value={creator[key] || ''}
                onChange={(e) => set(key, e.target.value)}
                placeholder={placeholder}
                disabled={locked}
                className="h-9"
                aria-invalid={invalid ? true : undefined}
              />
              {invalid && (
                <p className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" /> Not a {label} handle or link — it won&apos;t be saved
                </p>
              )}
            </div>
          );
        })}
      </div>
      {(canSaveNew || canUpdate) && (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={disabled || saving || uploading} onClick={canUpdate ? updateSaved : saveNew}>
            {saving
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              : <BookmarkPlus className="h-3.5 w-3.5" aria-hidden="true" />}
            {canUpdate ? 'Update saved creator' : 'Save creator for future videos'}
          </Button>
          <span className="text-xs text-muted-foreground">
            {canUpdate
              ? 'Changes every video that credits them.'
              : 'Keeps their picture and handles so you can pick them on any other video, and gives them a page listing the events they have covered.'}
          </span>
        </div>
      )}
      {preview && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground">Preview</p>
          <VideoCreatorCredit creator={preview} linkProfile={false} />
        </div>
      )}
    </div>
  );
};

const VideoRow = ({ video, index, count, onChange, onRemove, onMove, disabled, savedCreators, isAdmin, onSavedChange }) => {
  const n = index + 1;
  const id = youTubeVideoId(video.url);
  const typed = video.url.trim().length > 0;
  const hasCreator = Boolean(cleanVideoCreator(video.creator));
  const [creatorOpen, setCreatorOpen] = useState(hasCreator);

  return (
    <div className="rounded-2xl border border-border bg-muted/20 p-3 space-y-2">
      <div className="flex items-start gap-3">
        <div className="w-24 shrink-0 aspect-video rounded-lg overflow-hidden bg-muted flex items-center justify-center">
          {id ? (
            <img src={youTubeThumbnailUrl(id)} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-[10px] font-semibold text-muted-foreground">Video {n}</span>
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="space-y-1">
            <Label htmlFor={`video-url-${n}`} className="sr-only">Video {n} YouTube URL</Label>
            <Input
              id={`video-url-${n}`}
              type="url"
              value={video.url}
              onChange={(e) => onChange({ ...video, url: e.target.value })}
              placeholder="https://www.youtube.com/watch?v=…"
              disabled={disabled}
              className="h-9"
              aria-invalid={typed && !id ? true : undefined}
            />
            {typed && (
              <p className={`flex items-center gap-1 text-xs ${id ? 'text-muted-foreground' : 'text-destructive'}`}>
                {id
                  ? <><CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> YouTube video found</>
                  : <><AlertCircle className="w-3.5 h-3.5" aria-hidden="true" /> Not a YouTube link — paste a youtube.com or youtu.be URL</>}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor={`video-title-${n}`} className="sr-only">Video {n} title</Label>
            <Input
              id={`video-title-${n}`}
              value={video.title}
              onChange={(e) => onChange({ ...video, title: e.target.value.slice(0, MAX_VIDEO_TITLE_CHARS) })}
              placeholder="Title (optional) — e.g. 2025 recap, Vendor walkthrough"
              maxLength={MAX_VIDEO_TITLE_CHARS}
              disabled={disabled}
              className="h-9"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8"
            onClick={() => onMove(-1)} disabled={disabled || index === 0} aria-label={`Move video ${n} up`}>
            <ArrowUp className="w-3.5 h-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8"
            onClick={() => onMove(1)} disabled={disabled || index === count - 1} aria-label={`Move video ${n} down`}>
            <ArrowDown className="w-3.5 h-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={onRemove} disabled={disabled} aria-label={`Remove video ${n}`}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      <Button
        type="button" variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs"
        onClick={() => setCreatorOpen((open) => !open)} aria-expanded={creatorOpen} disabled={disabled}
      >
        <UserRound className="w-3.5 h-3.5" aria-hidden="true" />
        {hasCreator ? `Creator credit${video.creator?.name ? ` — ${video.creator.name}` : ''}` : 'Add creator credit (picture & socials)'}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${creatorOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
      </Button>
      {creatorOpen && (
        <CreatorFields
          video={video} n={n} onChange={onChange} disabled={disabled}
          savedCreators={savedCreators} isAdmin={isAdmin} onSavedChange={onSavedChange}
        />
      )}
    </div>
  );
};

const EventVideosEditor = ({ value = [], onChange, disabled = false }) => {
  const videos = value.length ? value : [emptyVideo()];
  const filled = videos.filter((v) => youTubeVideoId(v.url)).length;
  const isAdmin = Boolean(useAuth()?.isAdmin);

  // The saved creators, for the picker in each video's credit. A failed read
  // only hides the picker — the credit can still be typed.
  const [savedCreators, setSavedCreators] = useState([]);
  const loadSaved = (fresh = false) => fetchSavedCreators({ fresh }).then(setSavedCreators).catch(() => {});
  useEffect(() => { loadSaved(); }, []);

  const update = (i, video) => onChange(videos.map((v, j) => (j === i ? video : v)));
  const remove = (i) => {
    const next = videos.filter((_, j) => j !== i);
    onChange(next.length ? next : [emptyVideo()]);
  };
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= videos.length) return;
    const next = [...videos];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = () => {
    if (videos.length >= MAX_EVENT_VIDEOS) { toast.error(`An event holds up to ${MAX_EVENT_VIDEOS} videos.`); return; }
    onChange([...videos, emptyVideo()]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Label className="font-bold">
          Event Videos <span className="text-muted-foreground font-normal text-xs">(optional — YouTube, shown below the photo gallery)</span>
        </Label>
        <span className="text-xs text-muted-foreground tabular-nums">{filled} video{filled === 1 ? '' : 's'}</span>
      </div>
      <p className="text-xs text-muted-foreground -mt-1">
        Paste YouTube links — a recap, a vendor walkthrough, last year&apos;s highlights. The first video starts playing by itself (muted) a few seconds after the page opens, so put the best one first. Each is also added to the page&apos;s structured data for video search.
      </p>

      {videos.map((video, i) => (
        <VideoRow
          key={i}
          video={video}
          index={i}
          count={videos.length}
          disabled={disabled}
          onChange={(next) => update(i, next)}
          onRemove={() => remove(i)}
          onMove={(dir) => move(i, dir)}
          savedCreators={savedCreators}
          isAdmin={isAdmin}
          onSavedChange={() => loadSaved(true)}
        />
      ))}

      <Button
        type="button" variant="outline" size="sm" onClick={add}
        disabled={disabled || videos.length >= MAX_EVENT_VIDEOS}
        className="gap-1.5"
      >
        <Plus className="w-4 h-4" aria-hidden="true" /> Add another video
      </Button>
    </div>
  );
};

export default EventVideosEditor;
