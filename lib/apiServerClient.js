import { supabase } from '@/lib/supabaseClient.js';

const API_SERVER_URL = '/hcgi/api';

const apiServerClient = {
  fetch: async (url, options = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = { ...options.headers };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return window.fetch(API_SERVER_URL + url, { ...options, headers });
  },
};

export default apiServerClient;
export { apiServerClient };
