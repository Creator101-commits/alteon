import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseToken } from './supabase-token';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

// Create Supabase client with a custom fetch that injects the Supabase JWT
// (signed with sub = Firebase UID) when the user is authenticated.
// When no custom token is available, the default anon-key Authorization
// header from supabase-js is left untouched so unauthenticated pages work.
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      try {
        const token = await getSupabaseToken();
        if (token) {
          const headers = new Headers(init?.headers);
          headers.set('Authorization', `Bearer ${token}`);
          return fetch(input, { ...init, headers });
        }
      } catch {
        // Fall through to default fetch with anon key
      }
      return fetch(input, init);
    },
    headers: {
      'X-Client-Info': 'alteon-web-app',
    },
  },
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  db: {
    schema: 'public',
  },
});

export default supabase;
