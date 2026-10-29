import React from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  MAX_EVENT_VIDEOS,
  MAX_VIDEO_TITLE_CHARS,
  emptyVideo,
  youTubeVideoId,
  youTubeThumbnailUrl,
} from '@/utils/eventVideos.js';

// Video list for the event form. Controlled: `value` is [{ title, url }] in
// display order; the form normalises it with cleanEventVideos on save. The
// event page embeds them below the photo gallery
// (components/events/EventVideos.jsx) and starts the first one by itself.
const VideoRow = ({ video, index, count, onChange, onRemove, onMove, disabled }) => {
  const n = index + 1;
  const id = youTubeVideoId(video.url);
  const typed = video.url.trim().length > 0;

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
