import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient.js';

// Visiting /logout force-clears the Supabase session and all related
// localStorage keys, then redirects to home. Useful as an emergency
// escape hatch when the normal logout button is unreachable.
const LogoutPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const forceLogout = async () => {
      try {
        await supabase.auth.signOut();
      } catch (_) {}
      try {
        Object.keys(localStorage)
          .filter(k => k.startsWith('sb-'))
          .forEach(k => localStorage.removeItem(k));
      } catch (_) {}
      navigate('/', { replace: true });
    };
    forceLogout();
  }, [navigate]);

  return null;
};

export default LogoutPage;
