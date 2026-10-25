import React, { useState, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  MessagesSquare, Search, Loader2, RefreshCw, ArrowRight, ShieldAlert, X,
} from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import ProfileAvatar from '@/components/ProfileAvatar.jsx';
import { orFilterTerm } from '@/src/utils/orFilterTerm.js';

// Admin chat moderation / search.
//
// Reads run through the admin's own Supabase session — the "Admins can view all
// messages" RLS policy is what authorises reading conversations the admin is not
// a participant in, so this page only works for genuine admins (and the route is
// additionally gated by ProtectedAdminRoute). It is intentionally read-only.

const PAGE_LIMIT = 100;

// Strip PostgREST filter-grammar + LIKE wildcards from a user term before it is
// interpolated into an `.or()` string, and clamp its length. Shared with the
// other admin search pages — the local copy this replaced missed `_` (a
// single-character LIKE wildcard) and `\` (its escape character).
const sanitizeTerm = (raw) => orFilterTerm(raw);

const nameOf = (p) => p?.display_name || p?.username || 'Unknown user';

const ChatModerationPage = () => {
  const [term, setTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null); // null = no search yet
  const [profiles, setProfiles] = useState({}); // id -> profile
  const [thread, setThread] = useState(null);    // { a, b } participant ids
  const [threadMsgs, setThreadMsgs] = useState([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const reqRef = useRef(0);

  // Resolve a set of user ids to display profiles in one query.
  const loadProfiles = useCallback(async (ids) => {
    const unique = [...new Set(ids)].filter(Boolean);
    if (unique.length === 0) return {};
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, username, avatar_url, profile_photo_or_character, is_admin')
      .in('id', unique);
    return Object.fromEntries((data ?? []).map((p) => [p.id, p]));
  }, []);

  const runSearch = useCallback(async (e) => {
    e?.preventDefault();
    const clean = sanitizeTerm(term);
    const myReq = ++reqRef.current;
    setLoading(true);
    try {
      // 1. Messages whose body contains the term (body filter is parameterised).
      const byBodyP = clean
        ? supabase.from('messages').select('*').ilike('body', `%${clean}%`)
            .order('created_at', { ascending: false }).limit(PAGE_LIMIT)
        : supabase.from('messages').select('*')
            .order('created_at', { ascending: false }).limit(PAGE_LIMIT);

      // 2. Messages involving a user whose name/username matches the term.
      let byUserP = Promise.resolve({ data: [] });
      if (clean) {
        const { data: users } = await supabase
          .from('profiles')
          .select('id')
          .or(`display_name.ilike.%${clean}%,username.ilike.%${clean}%`)
          .limit(20);
        const uids = (users ?? []).map((u) => u.id);
        if (uids.length) {
          const orFilter = uids
            .flatMap((id) => [`sender_id.eq.${id}`, `recipient_id.eq.${id}`])
            .join(',');
          byUserP = supabase.from('messages').select('*').or(orFilter)
            .order('created_at', { ascending: false }).limit(PAGE_LIMIT);
        }
      }

      const [{ data: byBody, error: e1 }, { data: byUser, error: e2 }] =
        await Promise.all([byBodyP, byUserP]);
      if (e1) throw e1;
      if (e2) throw e2;
      if (myReq !== reqRef.current) return; // superseded

      // Merge + dedupe by id, newest first.
      const merged = [...(byBody ?? []), ...(byUser ?? [])];
      const seen = new Set();
      const deduped = merged
        .filter((m) => (seen.has(m.id) ? false : seen.add(m.id)))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, PAGE_LIMIT);

      const profMap = await loadProfiles(deduped.flatMap((m) => [m.sender_id, m.recipient_id]));
      if (myReq !== reqRef.current) return;
      setProfiles(profMap);
      setResults(deduped);
    } catch (err) {
      toast.error('Failed to search messages.');
      if (myReq === reqRef.current) setResults([]);
    } finally {
      if (myReq === reqRef.current) setLoading(false);
    }
  }, [term, loadProfiles]);

  // Open the full conversation between two users.
  const openThread = useCallback(async (a, b) => {
    setThread({ a, b });
    setThreadLoading(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(
          `and(sender_id.eq.${a},recipient_id.eq.${b}),and(sender_id.eq.${b},recipient_id.eq.${a})`,
        )
        .order('created_at', { ascending: true })
        .limit(500);
      if (error) throw error;
      // Pull in any profiles we don't already have.
      const need = [a, b].filter((id) => !profiles[id]);
      if (need.length) {
        const extra = await loadProfiles(need);
        setProfiles((prev) => ({ ...prev, ...extra }));
      }
      setThreadMsgs(data ?? []);
    } catch (err) {
      toast.error('Failed to load conversation.');
      setThreadMsgs([]);
    } finally {
      setThreadLoading(false);
    }
  }, [profiles, loadProfiles]);

  const threadOther = thread ? profiles[thread.b] : null;
  const threadFirst = thread ? profiles[thread.a] : null;

  return (
    <div className="space-y-6">
      <Helmet><title>Chat Moderation | CardPop Admin</title></Helmet>

      <AdminPageHeader
        icon={MessagesSquare}
        title="Chat Moderation"
        subtitle="Search and review member conversations for safety and policy compliance."
      >
        <Button
          variant="outline"
          onClick={runSearch}
          disabled={loading}
          className="rounded-xl h-10 px-4 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </AdminPageHeader>

      {/* Search bar */}
      <form onSubmit={runSearch} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search message text, or a member's name / username…"
            className="pl-9 h-11 rounded-xl"
          />
        </div>
        <Button type="submit" disabled={loading} className="h-11 rounded-xl px-6 font-bold">
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
          Search
        </Button>
      </form>

      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 border border-border rounded-xl px-4 py-3">
        <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
        <p>
          Conversations are private to their two participants. This admin view is logged-in-only and
          read-only — for safety and policy enforcement. Leave an empty search and hit Search to load the
          most recent messages platform-wide.
        </p>
      </div>

      {/* Results */}
      {results === null ? (
        <div className="text-center py-20 text-muted-foreground">
          <MessagesSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Search to review member conversations.</p>
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No messages found.</p>
        </div>
      ) : (
        <div className="border border-border rounded-2xl overflow-hidden divide-y divide-border">
          {results.map((m) => {
            const sender = profiles[m.sender_id];
            const recipient = profiles[m.recipient_id];
            return (
              <button
                key={m.id}
                onClick={() => openThread(m.sender_id, m.recipient_id)}
                className="w-full text-left p-4 hover:bg-muted/40 transition-colors flex flex-col gap-2"
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                  <ProfileAvatar profile={sender} size="xs" name={nameOf(sender)} />
                  <span className="font-bold text-foreground">{nameOf(sender)}</span>
                  <ArrowRight className="w-3 h-3" />
                  <ProfileAvatar profile={recipient} size="xs" name={nameOf(recipient)} />
                  <span className="font-bold text-foreground">{nameOf(recipient)}</span>
                  {!m.read_at && <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-600">Unread</Badge>}
                  <span className="ml-auto">{format(new Date(m.created_at), 'd MMM yyyy, h:mm a')}</span>
                </div>
                <p className="text-sm text-foreground/90 line-clamp-2 pl-9">{m.body}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Thread viewer */}
      <Dialog open={!!thread} onOpenChange={(o) => { if (!o) { setThread(null); setThreadMsgs([]); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 border-b border-border">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <MessagesSquare className="w-5 h-5 text-primary" />
              Conversation
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2 pt-1">
              <span className="font-semibold text-foreground">{nameOf(threadFirst)}</span>
              <ArrowRight className="w-3.5 h-3.5" />
              <span className="font-semibold text-foreground">{nameOf(threadOther)}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-muted/10">
            {threadLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : threadMsgs.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">No messages in this conversation.</p>
            ) : (
              threadMsgs.map((m) => {
                const fromFirst = m.sender_id === thread?.a;
                const sender = profiles[m.sender_id];
                return (
                  <div key={m.id} className={`flex flex-col ${fromFirst ? 'items-start' : 'items-end'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                      fromFirst ? 'bg-card border border-border' : 'bg-primary text-primary-foreground'
                    }`}>
                      <p className="text-[10px] font-bold opacity-70 mb-0.5">{nameOf(sender)}</p>
                      <p className="whitespace-pre-wrap break-words leading-relaxed">{m.body}</p>
                      <p className="text-[10px] opacity-60 mt-1 text-right">
                        {format(new Date(m.created_at), 'd MMM, h:mm a')}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChatModerationPage;
