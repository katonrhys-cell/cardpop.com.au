import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://vrfsaazuqjxotnieqlkd.supabase.co';

// The anon key is public (it ships in every browser bundle — see
// lib/supabaseClient.js); security comes from RLS, not from keeping it secret.
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY
  || process.env.VITE_SUPABASE_ANON_KEY
  || 'sb_publishable_lHlLkeTfwzhWQ80Zz6pL6g_jc7Y8p33';

/**
 * A Supabase client that sees exactly what an anonymous visitor sees.
 *
 * The public read endpoints (src/routes/public.js) run browser queries on the
 * server so Cloudflare can cache the answer. They MUST use this client, never
 * the service-role one: the whole point is that Row Level Security still
 * decides what is public, so a cached response can never contain a row an
 * anonymous visitor could not have fetched themselves.
 */
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export default supabaseAnon;
