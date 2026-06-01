import React from 'react';
import { useParams } from 'react-router-dom';
import SEOHead from '@/components/SEOHead.jsx';
import { UserCircle } from 'lucide-react';

const CommunityUserProfilePage = () => {
  const { userId } = useParams();

  return (
    <div className="container-default section-padding min-h-[70vh]">
      <SEOHead title="User Profile | CardPop Community" description="View this collector's profile, collection and trading history on CardPop." />
      
      <div className="bg-card border border-border p-12 rounded-3xl text-center max-w-2xl mx-auto">
        <UserCircle className="w-24 h-24 text-muted-foreground mx-auto mb-6" />
        <h1 className="text-3xl font-bold mb-2">User {userId}</h1>
        <p className="text-muted-foreground mb-8">Community Member</p>
        
        <div className="grid grid-cols-3 gap-4 border-t border-border pt-8">
          <div>
            <div className="text-2xl font-bold">0</div>
            <div className="text-sm text-muted-foreground">Posts</div>
          </div>
          <div>
            <div className="text-2xl font-bold">0</div>
            <div className="text-sm text-muted-foreground">Listings</div>
          </div>
          <div>
            <div className="text-2xl font-bold">0.0</div>
            <div className="text-sm text-muted-foreground">Rating</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommunityUserProfilePage;