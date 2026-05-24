import React from 'react';
import { Helmet } from 'react-helmet';
import { Star } from 'lucide-react';
import Breadcrumb from '@/components/Breadcrumb.jsx';

const AccountReviews = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Helmet>
        <title>Reviews | CardPop</title>
      </Helmet>

      <Breadcrumb items={[{ label: 'Account', path: '/account' }, { label: 'Reviews' }]} />

      <div>
        <h1 className="text-3xl font-bold font-heading mb-2">Reviews</h1>
        <p className="text-muted-foreground">Manage your feedback and ratings.</p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-12 text-center shadow-sm">
        <Star className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
        <h3 className="text-xl font-bold mb-2">No reviews yet</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          You haven't received any reviews from other users yet.
        </p>
      </div>
    </div>
  );
};

export default AccountReviews;