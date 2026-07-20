import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SEOHead from '@/components/SEOHead.jsx';
import BackButton from '@/components/BackButton.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { MessageSquarePlus } from 'lucide-react';

// Matches the category filters on ForumPage (minus the "All" pseudo-filter).
const CATEGORIES = ['General', 'Trading', 'Grading', 'Market Talk', 'Buying Advice', 'Show & Tell', 'Events'];

const CommunityDiscussionNewPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('General');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

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
    <div className="container-default section-padding min-h-screen max-w-2xl mx-auto">
      <SEOHead
        title="Start a Discussion | CardPop Community"
        description="Start a new discussion with Australian trading card collectors on CardPop."
        noindex
      />
      <BackButton fallback="/community/forum" className="mb-8" />

      <div className="flex items-center gap-3 mb-6">
        <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-sm">
          <MessageSquarePlus className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-2xl font-bold font-serif">Start a Discussion</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-card border border-border rounded-3xl p-6 md:p-8">
        <div className="space-y-2">
          <Label htmlFor="title" className="font-bold text-sm">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What do you want to talk about?"
            maxLength={140}
            className="rounded-xl h-12"
          />
        </div>

        <div className="space-y-2">
          <Label className="font-bold text-sm">Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-12 rounded-xl">
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
          <Label htmlFor="body" className="font-bold text-sm">Details</Label>
          <Textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share your thoughts, questions or insights…"
            maxLength={5000}
            rows={8}
            className="rounded-xl"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" className="rounded-xl font-bold" onClick={() => navigate('/community/forum')} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" className="rounded-xl font-bold" disabled={saving || !title.trim() || !body.trim()}>
            {saving ? 'Posting…' : 'Post Discussion'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CommunityDiscussionNewPage;
