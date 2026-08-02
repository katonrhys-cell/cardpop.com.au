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
 * A Supabase client that acts AS THE CALLER, not as the service role.
 *
 * Backend routes that orchestrate user-owned writes (vault items, listings)
 * should use this instead of the service-role client so that Row Level
 * Security stays the single enforcement point: ownership checks, the
 * `private.can_sell()` selling gate, the locked `is_featured` /
 * base-value column pins and the listing-approval trigger all apply exactly
 * as they do for direct client-side writes. A service-role write would
 * silently bypass every one of those and each rule would have to be
 * re-implemented (and kept in sync) in JS.
 *
 * @param {string} accessToken the caller's Supabase JWT (already validated by
 *   authMiddleware — this factory does not re-validate it).
 */
export const createUserScopedClient = (accessToken) =>
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

export default createUserScopedClient;
