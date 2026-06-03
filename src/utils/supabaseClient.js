import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://odoglvswwymyjuwlonkf.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn(
    '[supabaseClient] WARNING: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY are not set. ' +
    'Backend auth and storage features will not work until these are added to your .env file.'
  );
}

const supabase = createClient(supabaseUrl ?? 'https://placeholder.supabase.co', supabaseServiceKey ?? 'placeholder', {
  auth: { autoRefreshToken: false, persistSession: false },
});

export default supabase;
export { supabase };
