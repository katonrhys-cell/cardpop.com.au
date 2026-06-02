import { createClient } from '@supabase/supabase-js';

// These are public anon credentials — safe to ship in client-side code.
// Security is enforced by Supabase Row Level Security policies, not by keeping these secret.
const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  || 'https://odoglvswwymyjuwlonkf.supabase.co';
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kb2dsdnN3d3lteWp1d2xvbmtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3OTQ5NTgsImV4cCI6MjA5NDM3MDk1OH0.R5fwR42iKIEsfx1iA-fjk4YPLCH3mcmoIKkosEy6g1I';

// Clear any stale sessionStorage tokens from previous sessions so users
// are not left in a half-authenticated state after the storage change.
try {
  Object.keys(sessionStorage)
    .filter(k => k.startsWith('sb-'))
    .forEach(k => sessionStorage.removeItem(k));
} catch { /* sessionStorage unavailable in some envs */ }

export const supabase = createClient(supabaseUrl, supabaseAnon, {
    auth: {
      persistSession:     true,
      autoRefreshToken:   true,
      detectSessionInUrl: true,
      // Use localStorage (Supabase default) — sessions persist across tabs
      // and browser restarts until the refresh token expires (~60 days).
    },
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  }
);

export default supabase;
