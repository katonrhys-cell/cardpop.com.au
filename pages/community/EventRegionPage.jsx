import React from 'react';
import { useParams } from 'react-router-dom';
import CommunityEventsPage from '@/pages/community/CommunityEventsPage.jsx';
import NotFoundPage from '@/pages/NotFoundPage.jsx';
import { eventRegionBySlug } from '@/data/eventRegions.js';

// /card-shows/<city> — the events calendar filtered to one state, with that
// city's SEO copy (data/eventRegions.js). An unknown city is a 404.
const EventRegionPage = () => {
  const { city } = useParams();
  const region = eventRegionBySlug(city);
  if (!region) return <NotFoundPage />;
  return <CommunityEventsPage region={region} />;
};

export default EventRegionPage;
