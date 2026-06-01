import { createClient } from '@supabase/supabase-js';

// These are public anon credentials — safe to ship in client-side code.
// Security is enforced by Supabase Row Level Security policies, not by keeping these secret.
const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  || 'https://odoglvswwymyjuwlonkf.supabase.co';
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kb2dsdnN3d3lteWp1d2xvbmtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3OTQ5NTgsImV4cCI6MjA5NDM3MDk1OH0.R5fwR42iKIEsfx1iA-fjk4YPLCH3mcmoIKkosEy6g1I';

// Use sessionStorage so sessions die when the tab is closed.
// localStorage (the Supabase default) would keep users logged in indefinitely
// across tab closes and browser restarts until the token expires (~1 week).
const sessionStorageAdapter = {
  getItem:    (key) => { try { return sessionStorage.getItem(key);         } catch { return null; } },
  setItem:    (key, value) => { try { sessionStorage.setItem(key, value);  } catch {} },
  removeItem: (key) => { try { sessionStorage.removeItem(key);             } catch {} },
};

// Clear any legacy localStorage tokens from before this change so old sessions
// cannot be re-hydrated after users have closed and reopened their browser.
try {
  Object.keys(localStorage)
    .filter(k => k.startsWith('sb-'))
    .forEach(k => localStorage.removeItem(k));
} catch { /* localStorage unavailable in some envs */ }

export const supabase = createClient(supabaseUrl, supabaseAnon, {
    auth: {
      persistSession:     true,
      autoRefreshToken:   true,
      detectSessionInUrl: true,
      storage:            sessionStorageAdapter,
    },
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  }
);

export default supabase;
