import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const MarketplaceListingRedirect = () => {
  const navigate = useNavigate();
  const { id, slug } = useParams();

  useEffect(() => {
    navigate(`/product/marketplace/${id}${slug ? `/${slug}` : ''}`, { replace: true });
  }, [id, slug, navigate]);

  return null;
};

export default MarketplaceListingRedirect;
