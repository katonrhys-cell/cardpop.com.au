import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { fetchParticipantRoles, EVENT_ROLE_LABELS } from '@/lib/eventBoard.js';
import { publicImageUrl } from '@/utils/imageUrl.js';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageSquare, Plus, Pin } from 'lucide-react';

const timeAgo = (iso) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

// Discussion threads attached to one event. Threads are ordinary community
// forum posts with event_id set, so they also appear in /community/forum and
// open on the shared discussion page. Reading posts requires a signed-in user
// (same RLS as the main forum), so anonymous visitors get a join prompt.
const EventDiscussion = ({ event }) => {
  const eventId = event?.id;
  const { isAuthenticated } = useAuth();
  const [threads, setThreads] = useState([]);
  const [roles, setRoles] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!eventId || !isAuthenticated) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('posts')
        .select('id, title, body, category, comment_count, is_pinned, created_at, author_id, profiles:author_id(id, display_name, username, avatar_url, profile_photo_or_character)')
        .eq('event_id', eventId)
        .eq('post_type', 'text')
        .order('created_at', { ascending: false })
        .limit(50);
      if (fetchError) throw fetchError;
      setThreads(data || []);
      const authorIds = (data || []).map((t) => t.author_id);
      if (authorIds.length > 0) {
        // Badge organiser/vendor authors; badges are decoration, so failures
        // shouldn't take the thread list down with them.
        try {
          setRoles(await fetchParticipantRoles(eventId, authorIds));
        } catch {
          setRoles({});
        }
      }
    } catch (err) {
      console.error('Failed to load event discussions:', err);
      setError('Unable to load discussions right now. Please try again shortly.');
      setThreads([]);
    } finally {
      setLoading(false);
    }
  }, [eventId, isAuthenticated]);

  useEffect(() => { load(); }, [load]);

  const resolveAvatar = (profile) => {
    const raw = profile?.avatar_url || profile?.profile_photo_or_character;
    return raw ? publicImageUrl(raw) : null;
  };

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between gap-3 mb-5">
        <h2 className="text-2xl font-bold font-serif flex items-center gap-2.5">
          <MessageSquare className="w-6 h-6 text-primary" /> Event Discussion
        </h2>
        {isAuthenticated && (
          <Button asChild className="rounded-xl font-bold gap-2">
            <Link to={`/community/discussion/new?eventId=${eventId}`}>
              <Plus className="w-4 h-4" /> Start a Discussion
            </Link>
          </Button>
        )}
      </div>

      {!isAuthenticated ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <p className="text-muted-foreground mb-4">
            Sign in to see what vendors and show-goers are saying about this event — and join the conversation.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button asChild className="rounded-xl font-bold"><Link to="/signup">Join to Post</Link></Button>
            <Button asChild variant="outline" className="rounded-xl font-bold"><Link to="/login">Sign In</Link></Button>
          </div>
        </div>
      ) : loading ? (
        <div className="space-y-3">
          {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
        </div>
      ) : error ? (
        <div className="bg-card border border-destructive/20 border-dashed rounded-2xl p-8 text-center">
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button onClick={load} variant="outline" className="rounded-xl font-bold">Try again</Button>
        </div>
      ) : threads.length === 0 ? (
        <div className="bg-card border border-border border-dashed rounded-2xl p-8 text-center">
          <MessageSquare className="w-10 h-10 text-muted-foreground opacity-40 mx-auto mb-3" />
          <p className="font-bold mb-1">No discussions yet</p>
          <p className="text-sm text-muted-foreground">Be the first to ask a question or share your plans for this event.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {threads.map((thread) => {
            const profile = thread.profiles;
            const role = roles[thread.author_id];
            return (
              <Link
                key={thread.id}
                to={`/community/discussion/${thread.id}`}
                className="block bg-card border border-border p-5 rounded-2xl hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30 transition-all group"
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <h3 className="font-bold text-base leading-snug group-hover:text-primary transition-colors">
                    {thread.title || 'Untitled Discussion'}
                  </h3>
                  {thread.is_pinned && <Pin className="w-4 h-4 text-primary shrink-0 mt-0.5" />}
                </div>
                {thread.body && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2 leading-relaxed">{thread.body}</p>
                )}
                <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5" /> {thread.comment_count || 0} replies
                  </span>
                  <span className="flex items-center gap-1.5 ml-auto">
                    {profile && (
                      <>
                        <Avatar className="h-4 w-4">
                          <AvatarImage src={resolveAvatar(profile)} />
                          <AvatarFallback className="text-[9px]">
                            {(profile.display_name || 'C').charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{profile.display_name || profile.username || 'Collector'}</span>
                        {role && (
                          <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wide">
                            {EVENT_ROLE_LABELS[role]}
                          </Badge>
                        )}
                        <span>·</span>
                      </>
                    )}
                    {thread.created_at && timeAgo(thread.created_at)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default EventDiscussion;
