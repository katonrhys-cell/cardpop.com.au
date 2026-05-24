import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import pb from '@/lib/pocketbaseClient';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare } from 'lucide-react';

const CommunityDiscussionPage = () => {
  const { id } = useParams();
  const [discussion, setDiscussion] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDisc = async () => {
      try {
        const res = await pb.collection('community_content').getOne(id, { $autoCancel: false });
        setDiscussion(res);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchDisc();
  }, [id]);

  if (loading) return <div className="container-default section-padding"><Skeleton className="h-[400px] rounded-2xl" /></div>;
  if (!discussion) return <div className="container-default section-padding text-center">Discussion not found</div>;

  return (
    <div className="container-default section-padding min-h-screen max-w-4xl mx-auto">
      <Helmet><title>{discussion.title || 'Discussion'} | Community</title></Helmet>
      
      <div className="bg-card border border-border p-8 rounded-3xl mb-8">
        <h1 className="text-3xl font-bold mb-4">{discussion.title}</h1>
        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-8 pb-4 border-b border-border">
          <span>By User ID: {discussion.userId}</span>
          <span>Category: {discussion.category}</span>
        </div>
        <div className="prose prose-slate dark:prose-invert max-w-none">
          <p>{discussion.content || 'No content provided.'}</p>
        </div>
      </div>

      <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
        <MessageSquare className="w-5 h-5"/> Replies
      </h3>
      <div className="text-center py-12 bg-secondary/50 rounded-2xl text-muted-foreground">
        Join the community to post a reply.
      </div>
    </div>
  );
};

export default CommunityDiscussionPage;