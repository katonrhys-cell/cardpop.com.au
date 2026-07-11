import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/**
 * A simple "Back" button for detail / profile pages.
 *
 * Prefers going back in the browser history so the user returns to wherever
 * they came from. When there's no in-app history to go back to — e.g. the
 * visitor landed directly from Google or a shared link — it falls back to the
 * section hub so the button never dead-ends off the site.
 */
const BackButton = ({ fallback = '/', label = 'Back', className = '' }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleClick = () => {
    // React Router sets location.key to 'default' when this is the first entry
    // in the app's history stack (direct landing) — nothing to go back to.
    if (location.key && location.key !== 'default') {
      navigate(-1);
    } else {
      navigate(fallback);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors ${className}`}
    >
      <ArrowLeft className="w-4 h-4" /> {label}
    </button>
  );
};

export default BackButton;
