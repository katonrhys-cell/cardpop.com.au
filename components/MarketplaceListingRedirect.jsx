import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

// Legacy /product/marketplace/:id/:slug URLs redirect to the canonical
// /marketplace/:id/:slug form (the one the sitemap and bot prerenderer emit).
// Full page loads are 301-redirected in vercel.json; this handles SPA-internal
// navigations from any stale links.
const MarketplaceListingRedirect = () => {
  const navigate = useNavigate();
  const { id, slug } = useParams();

  useEffect(() => {
    navigate(`/marketplace/${id}${slug ? `/${slug}` : ''}`, { replace: true });
  }, [id, slug, navigate]);

  return null;
};

export default MarketplaceListingRedirect;
