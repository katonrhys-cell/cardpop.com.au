import React, { useState } from 'react';
import { CalendarClock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  addDays, cleanPublishOn, formatPublishOn, scheduleError, suggestPublishOn, sydneyDateString,
} from '@/utils/blogSchedule.js';

/**
 * "Schedule" on a draft in Admin → Content: pick the date the article goes
 * live. The daily blog run publishes it that morning (about 7am Sydney time) —
 * see docs/blog-automation.md → Scheduled publishing. `takenDates` is every
 * other article's scheduled / published date, used to suggest a date a few
 * days after the last one so a queue of drafts spaces itself out.
 */
const ArticleScheduleButton = ({ article, takenDates = [], onChange }) => {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);
  const scheduled = cleanPublishOn(article.publish_on);
  const today = sydneyDateString();

  const onOpenChange = (next) => {
    if (next) setDate(scheduled || suggestPublishOn(takenDates, { today }));
    setOpen(next);
  };

  const save = async (publishOn) => {
    if (publishOn) {
      const problem = scheduleError(publishOn, today);
      if (problem) { toast.error(problem); return; }
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('blog_articles')
        .update({ publish_on: publishOn })
        .eq('id', article.id)
        .eq('is_published', false)
        .select('id');
      if (error) throw error;
      // Zero rows: it was published meanwhile (another tab, or the daily run).
      if (!data?.length) {
        toast.error('This article has already been published, so there is nothing to schedule.');
        return;
      }
      onChange?.(publishOn);
      toast.success(publishOn ? `Scheduled for ${formatPublishOn(publishOn)}.` : 'Schedule removed — the article stays a draft.');
      setOpen(false);
    } catch (err) {
      toast.error(/publish_on/i.test(err.message || '')
        ? 'Scheduling isn’t available yet — the database update for it hasn’t been applied.'
        : `Couldn’t save the schedule: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          title={scheduled ? 'Change or remove the publish date' : 'Choose a date for this draft to go live'}
        >
          <CalendarClock className="w-3.5 h-3.5" />
          {scheduled ? formatPublishOn(scheduled) : 'Schedule'}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3">
        <div>
          <Label htmlFor={`publish-on-${article.id}`} className="text-sm font-semibold">Publish on</Label>
          <Input
            id={`publish-on-${article.id}`}
            type="date"
            className="mt-1.5"
            value={date}
            min={addDays(today, 1)}
            max={addDays(today, 365)}
            onChange={(e) => setDate(e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1.5">
            Goes live that morning, about 7am Sydney time. Spacing articles a few days apart reads better than several on one day.
          </p>
        </div>
        <div className="flex items-center justify-between gap-2">
          {scheduled ? (
            <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => save(null)}>
              Remove
            </Button>
          ) : <span />}
          <Button type="button" size="sm" disabled={saving || !date} onClick={() => save(date)}>
            {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            {scheduled ? 'Update' : 'Schedule'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ArticleScheduleButton;
