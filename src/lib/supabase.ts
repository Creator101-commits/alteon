import { createClient } from '@supabase/supabase-js';
import { getSupabaseToken } from './supabase-token';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

// Create Supabase client with custom accessToken for RLS.
// On every request the client calls getSupabaseToken() which returns
// a JWT signed with the Supabase secret, containing sub = Firebase UID.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  accessToken: async () => {
    const token = await getSupabaseToken();
    return token ?? '';
  },
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'X-Client-Info': 'alteon-web-app',
    },
  },
});

export default supabase;
