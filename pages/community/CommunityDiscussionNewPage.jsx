import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import SEOHead from '@/components/SEOHead.jsx';
import Breadcrumb from '@/components/Breadcrumb.jsx';
import EventPicker from '@/components/events/EventPicker.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { EVENT_PICKER_COLUMNS } from '@/utils/eventPicker.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { MessageSquarePlus, CalendarDays, Lightbulb, ShieldCheck } from 'lucide-react';

// Matches the category filters on ForumPage (minus the "All" pseudo-filter).
const CATEGORIES = ['General', 'Trading', 'Grading', 'Market Talk', 'Buying Advice', 'Show & Tell', 'Events'];

const TITLE_MAX = 140;
const BODY_MAX = 5000;

const CommunityDiscussionNewPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  // Arriving from an event page (?eventId=…) pre-selects that event; anyone
  // can also search for one in the picker. A linked discussion shows up in
  // the event page's discussion section as well as the forum.
  const eventId = searchParams.get('eventId');
  const [linkedEvent, setLinkedEvent] = useState(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(eventId ? 'Events' : 'General');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!eventId) return undefined;
    supabase
      .from('events_public')
      .select(EVENT_PICKER_COLUMNS)
      .eq('id', eventId)
      .maybeSingle()
      .then(({ data }) => { if (!cancelled && data) setLinkedEvent(data); });
    return () => { cancelled = true; };
  }, [eventId]);

  const handleEventSelect = (event) => {
    setLinkedEvent(event);
    // Linking an event is a strong hint about the category; don't override a
    // category the author already picked on purpose.
    if (event && category === 'General') setCategory('Events');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (trimmedTitle.length < 5) { toast.error('Give your discussion a title of at least 5 characters.'); return; }
    if (trimmedBody.length < 10) { toast.error('Add a bit more detail (at least 10 characters).'); return; }
    if (!currentUser?.id) { toast.error('Please sign in to start a discussion.'); return; }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('posts')
        .insert({
          author_id: currentUser.id,
          title: trimmedTitle,
          body: trimmedBody,
          category,
          post_type: 'text',
          is_visible: true,
          // Only rows read back from events_public get here, so the FK holds.
          event_id: linkedEvent?.id || null,
        })
        .select('id')
        .single();
      if (error) throw error;
      toast.success('Discussion posted!');
      navigate(`/community/discussion/${data.id}`);
    } catch (err) {
      toast.error(err.message || 'Failed to post your discussion. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Start a Discussion | CardPop Community"
        description="Start a new discussion with Australian trading card collectors on CardPop."
        noindex
      />

      <div className="container-default pt-6">
        <Breadcrumb
          items={[
            { label: 'Home', path: '/' },
            { label: 'Community', path: '/community' },
            { label: 'Forum', path: '/community/forum' },
            { label: 'Start a Discussion' },
          ]}
        />
      </div>

      <section className="bg-card border-b border-border py-10 md:py-12">
        <div className="container-default flex items-center gap-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary shadow-sm shrink-0">
            <MessageSquarePlus className="w-7 h-7 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <h1 className="text-3xl md:text-4xl font-bold font-serif">Start a Discussion</h1>
            <p className="text-muted-foreground mt-1">
              Ask a question, share a pull or plan your next card show with collectors across Australia.
            </p>
          </div>
        </div>
      </section>

      <div className="container-default py-10">
        <div className="grid gap-8 lg:grid-cols-3">
          <form
            onSubmit={handleSubmit}
            className="lg:col-span-2 space-y-6 bg-card border border-border rounded-2xl p-6 md:p-8"
          >
            <div className="space-y-2">
              <Label htmlFor="title" className="font-bold text-sm">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What do you want to talk about?"
                maxLength={TITLE_MAX}
                className="rounded-xl h-12"
              />
              <p className="text-xs text-muted-foreground text-right">{title.length}/{TITLE_MAX}</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="category" className="font-bold text-sm">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="category" className="h-12 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="event" className="font-bold text-sm">
                  Link to an event <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <EventPicker value={linkedEvent} onSelect={handleEventSelect} disabled={saving} />
              </div>
            </div>
            {linkedEvent && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground -mt-3">
                <CalendarDays className="w-3.5 h-3.5 text-primary shrink-0" />
                This discussion will also appear on the event&apos;s page.
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="body" className="font-bold text-sm">Details</Label>
              <Textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Share your thoughts, questions or insights…"
                maxLength={BODY_MAX}
                rows={10}
                className="rounded-xl"
              />
              <p className="text-xs text-muted-foreground text-right">{body.length}/{BODY_MAX}</p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="outline" className="rounded-xl font-bold mt-4" onClick={() => navigate('/community/forum')} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl font-bold mt-4" disabled={saving || !title.trim() || !body.trim()}>
                {saving ? 'Posting…' : 'Post Discussion'}
              </Button>
            </div>
          </form>

          <aside className="space-y-4">
            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="font-bold flex items-center gap-2 mb-3">
                <Lightbulb className="w-4 h-4 text-primary" /> Tips for a great post
              </h2>
              <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
                <li>Make the title a clear question or topic.</li>
                <li>Name the card, set and grade when you&apos;re asking about value.</li>
                <li>Talking about a card show? Link the event so attendees see it on the event page.</li>
              </ul>
            </div>
            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="font-bold flex items-center gap-2 mb-3">
                <ShieldCheck className="w-4 h-4 text-primary" /> Keep it friendly
              </h2>
              <p className="text-sm text-muted-foreground">
                Be respectful of other collectors, and never share payment or personal contact details in a post.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default CommunityDiscussionNewPage;
