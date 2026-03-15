import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ensureSupabaseTokenReady } from './supabase-token';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

// Create Supabase client with a custom fetch that injects the Supabase JWT
// (signed with sub = Firebase UID) when the user is authenticated.
// For authenticated users, we avoid falling back to anon auth because RLS
// would reject requests and create startup race conditions.
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      try {
        const token = await ensureSupabaseTokenReady(10_000);
        if (!token) {
          throw new Error('Supabase JWT unavailable');
        }

        const headers = new Headers(init?.headers);
        headers.set('Authorization', `Bearer ${token}`);
        return fetch(input, { ...init, headers });
      } catch (error) {
        console.error('Blocked Supabase request without JWT:', error);
        throw error;
      }
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
