import React, { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, AlertCircle, ChevronDown, Loader2, Plus, Trash2, UserRound } from 'lucide-react';
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

// Video list for the event form. Controlled: `value` is [{ title, url, creator? }] in
// display order; the form normalises it with cleanEventVideos on save. The
// event page embeds them below the photo gallery
// (components/events/EventVideos.jsx) and starts the first one by itself.
// The creator credit for one video: picture, name and social handles, shown
// under the player on the page. The picture uploads as soon as it is picked
// (the row then just holds its URL); socials take a handle or a pasted link
// and are checked against that platform as they are typed.
const CreatorFields = ({ video, n, onChange, disabled }) => {
  const creator = video.creator || {};
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const set = (key, value) => onChange({ ...video, creator: { ...creator, [key]: value } });

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
          <Button type="button" variant="outline" size="sm" disabled={disabled || uploading} onClick={() => fileRef.current?.click()}>
            {creator.avatar_url ? 'Change picture' : 'Upload picture'}
          </Button>
          {creator.avatar_url && (
            <Button type="button" variant="ghost" size="sm" disabled={disabled || uploading} onClick={() => set('avatar_url', '')}>
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
          disabled={disabled}
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
                disabled={disabled}
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
      {preview && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground">Preview</p>
          <VideoCreatorCredit creator={preview} />
        </div>
      )}
    </div>
  );
};

const VideoRow = ({ video, index, count, onChange, onRemove, onMove, disabled }) => {
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
      {creatorOpen && <CreatorFields video={video} n={n} onChange={onChange} disabled={disabled} />}
    </div>
  );
};

const EventVideosEditor = ({ value = [], onChange, disabled = false }) => {
  const videos = value.length ? value : [emptyVideo()];
  const filled = videos.filter((v) => youTubeVideoId(v.url)).length;

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
