import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import pb from '@/lib/pocketbaseClient';
import { MessageSquare, Users, MessageCircle as MessageCircleOff } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

const CommunityPage = () => {
  const [discussions, setDiscussions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDiscussions = async () => {
      try {
        const res = await pb.collection('community_content').getList(1, 10, {
          filter: 'contentType="discussion"',
          sort: '-created',
          $autoCancel: false
        });
        setDiscussions(res.items);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchDiscussions();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Helmet><title>Community Hub | CardPop</title></Helmet>

      <section className="bg-card border-b border-border py-20 text-center">
        <div className="container-default">
          <Users className="w-12 h-12 text-primary mx-auto mb-6" />
          <h1 className="text-4xl md:text-5xl font-bold mb-4">The Collector's Hub</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Join the conversation. Share your pulls, discuss market trends, and connect with fellow collectors.
          </p>
          <Button size="lg" className="radius-btn">Start a Discussion</Button>
        </div>
      </section>

      <section className="container-default section-padding max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold mb-8">Recent Discussions</h2>
        <div className="space-y-4">
          {loading ? (
            Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
          ) : discussions.length > 0 ? (
            discussions.map(post => (
              <Link key={post.id} to={`/community/discussion/${post.id}`} className="block bg-card border border-border p-6 rounded-2xl card-hover">
                <h3 className="font-bold text-lg mb-2">{post.title || 'Untitled Discussion'}</h3>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><MessageSquare className="w-4 h-4"/> {post.replies?.length || 0} replies</span>
                  <span>Category: {post.category || 'General'}</span>
                </div>
              </Link>
            ))
          ) : (
             <div className="flex flex-col items-center justify-center py-16 bg-muted/30 rounded-3xl border border-border border-dashed">
               <MessageCircleOff className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
               <p className="text-foreground text-xl font-bold mb-2">No discussions found</p>
               <p className="text-sm text-muted-foreground">Be the first to start a conversation!</p>
             </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default CommunityPage;