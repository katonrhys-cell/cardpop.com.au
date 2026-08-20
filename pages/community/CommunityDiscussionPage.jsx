import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import SEOHead from '@/components/SEOHead.jsx';
import BackButton from '@/components/BackButton.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { fetchParticipantRoles, EVENT_ROLE_LABELS } from '@/lib/eventBoard.js';
import { publicImageUrl } from '@/utils/imageUrl.js';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { MessageSquare, CalendarDays, Trash2, Loader2 } from 'lucide-react';

const timeAgo = (iso) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const PROFILE_SELECT = 'profiles:author_id(id, display_name, username, avatar_url, profile_photo_or_character)';

const CommunityDiscussionPage = () => {
  const { id } = useParams();
  const { currentUser, isAuthenticated } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  const [discussion, setDiscussion] = useState(null);
  const [replies, setReplies] = useState([]);
  const [linkedEvent, setLinkedEvent] = useState(null);
  const [roles, setRoles] = useState({});
  const [loading, setLoading] = useState(true);
  const [replyBody, setReplyBody] = useState('');
  const [savingReply, setSavingReply] = useState(false);

  const loadReplies = useCallback(async () => {
    const { data, error } = await supabase
      .from('comments')
      .select(`*, ${PROFILE_SELECT}`)
      .eq('post_id', id)
      .eq('is_visible', true)
      .order('created_at', { ascending: true });
    if (error) throw error;
    setReplies(data || []);
    return data || [];
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    const fetchDisc = async () => {
      setLoading(true);
      try {
        const { data, error: fetchError } = await supabase
          .from('posts')
          .select(`*, ${PROFILE_SELECT}`)
          .eq('id', id)
          .single();
        if (fetchError) throw fetchError;
        if (cancelled) return;
        setDiscussion(data);

        // Fire-and-forget view counter (definer RPC — the posts UPDATE policy
        // only allows authors).
        supabase.rpc('increment_post_views', { p_post_id: id }).then(() => {}, () => {});

        const loadedReplies = await loadReplies().catch(() => []);
        if (cancelled) return;

        if (data.event_id) {
          // Discussion is attached to an event: show a link back to it and
          // badge organiser/vendor participants.
          const [eventRes, roleMap] = await Promise.all([
            supabase.from('events_public').select('id, title, slug').eq('id', data.event_id).maybeSingle(),
            fetchParticipantRoles(data.event_id, [data.author_id, ...loadedReplies.map((r) => r.author_id)]).catch(() => ({})),
          ]);
          if (cancelled) return;
          setLinkedEvent(eventRes.data || null);
          setRoles(roleMap);
        }
      } catch (error) {
        console.error('Failed to load discussion:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchDisc();
    return () => { cancelled = true; };
  }, [id, loadReplies]);

  const refreshRoles = useCallback(async (eventId, replyList) => {
    if (!eventId) return;
    try {
      setRoles(await fetchParticipantRoles(eventId, [discussion?.author_id, ...replyList.map((r) => r.author_id)]));
    } catch {
      // badges are decorative — ignore
    }
  }, [discussion?.author_id]);

  const handleReply = async (e) => {
    e.preventDefault();
    const body = replyBody.trim();
    if (body.length < 2) { toast.error('Write a little more before posting.'); return; }
    if (!currentUser?.id) { toast.error('Please sign in to reply.'); return; }
    setSavingReply(true);
    try {
      const { error } = await supabase.from('comments').insert({
        post_id: id,
        author_id: currentUser.id,
        body,
      });
      if (error) throw error;
      setReplyBody('');
      const updated = await loadReplies();
      refreshRoles(discussion?.event_id, updated);
      toast.success('Reply posted!');
    } catch (err) {
      toast.error(err.message || 'Failed to post your reply. Please try again.');
    } finally {
      setSavingReply(false);
    }
  };

  const handleDeleteReply = async (reply) => {
    try {
      const { error } = await supabase.from('comments').delete().eq('id', reply.id);
      if (error) throw error;
      toast('Reply removed');
      loadReplies().catch(() => {});
    } catch (err) {
      toast.error(err.message || 'Could not remove the reply.');
    }
  };

  const resolveAvatar = (profile) => {
    const raw = profile?.avatar_url || profile?.profile_photo_or_character;
    return raw ? publicImageUrl(raw) : null;
  };

  const authorName = (profile) => profile?.display_name || profile?.username || 'Collector';

  const roleBadge = (authorId) => {
    const role = roles[authorId];
    if (!role) return null;
    return (
      <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wide">
        {EVENT_ROLE_LABELS[role]}
      </Badge>
    );
  };

  if (loading) return <div className="container-default section-padding"><Skeleton className="h-[400px] rounded-2xl" /></div>;
  if (!discussion) return <div className="container-default section-padding text-center">Discussion not found</div>;

  return (
    <div className="container-default section-padding min-h-screen max-w-4xl mx-auto">
      <SEOHead title={`${discussion.title || 'Discussion'} | CardPop Community`} description={`Join the discussion: ${discussion.title || 'Community discussion on CardPop'}`} />

      <BackButton fallback="/community" className="mb-8" />

      {linkedEvent && (
        <Link
          to={`/events/${linkedEvent.slug || linkedEvent.id}`}
          className="inline-flex items-center gap-2 bg-primary/10 text-primary font-bold text-sm rounded-xl px-4 py-2 mb-6 hover:bg-primary/15 transition-colors"
        >
          <CalendarDays className="w-4 h-4" /> Event discussion: {linkedEvent.title}
        </Link>
      )}

      <div className="bg-card border border-border p-8 rounded-3xl mb-8">
        <h1 className="text-3xl font-bold mb-4">{discussion.title}</h1>
        <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground mb-8 pb-4 border-b border-border">
          <span>By {authorName(discussion.profiles)}</span>
          {roleBadge(discussion.author_id)}
          {discussion.category && <span>· {discussion.category}</span>}
          {discussion.created_at && <span>· {timeAgo(discussion.created_at)}</span>}
        </div>
        <div className="prose prose-slate dark:prose-invert max-w-none">
          <p className="whitespace-pre-line">{discussion.body || 'No content provided.'}</p>
        </div>
      </div>

      <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
        <MessageSquare className="w-5 h-5"/> Replies ({replies.length})
      </h3>

      {replies.length > 0 && (
        <div className="space-y-3 mb-8">
          {replies.map((reply) => {
            const mine = currentUser?.id === reply.author_id;
            return (
              <div key={reply.id} className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 flex-wrap text-sm">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={resolveAvatar(reply.profiles)} />
                      <AvatarFallback className="text-[10px]">
                        {authorName(reply.profiles).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-bold">{authorName(reply.profiles)}</span>
                    {roleBadge(reply.author_id)}
                    <span className="text-xs text-muted-foreground">· {timeAgo(reply.created_at)}</span>
                  </div>
                  {(mine || isAdmin) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                      title="Delete reply"
                      onClick={() => handleDeleteReply(reply)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-line">{reply.body}</p>
              </div>
            );
          })}
        </div>
      )}

      {isAuthenticated ? (
        <form onSubmit={handleReply} className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <Textarea
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            placeholder="Write a reply…"
            maxLength={3000}
            rows={4}
            className="rounded-xl"
          />
          <div className="flex justify-end">
            <Button type="submit" className="rounded-xl font-bold" disabled={savingReply || !replyBody.trim()}>
              {savingReply ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Post Reply'}
            </Button>
          </div>
        </form>
      ) : (
        <div className="text-center py-12 bg-secondary/50 rounded-2xl">
          <p className="text-muted-foreground mb-4">Join the community to post a reply.</p>
          <div className="flex items-center justify-center gap-3">
            <Button asChild className="rounded-xl font-bold"><Link to="/signup">Join Free</Link></Button>
            <Button asChild variant="outline" className="rounded-xl font-bold"><Link to="/login">Sign In</Link></Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommunityDiscussionPage;
