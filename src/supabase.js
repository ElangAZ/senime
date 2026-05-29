import { createClient } from '@supabase/supabase-js';

// Retrieve credentials from environment variables or fallback to localStorage
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || localStorage.getItem('senime_supabase_url') || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || localStorage.getItem('senime_supabase_anon_key') || '';

export const isSupabaseConfigured = () => {
  return supabaseUrl.trim() !== '' && supabaseAnonKey.trim() !== '';
};

export const getSupabaseCredentials = () => {
  return {
    url: supabaseUrl || localStorage.getItem('senime_supabase_url') || '',
    key: supabaseAnonKey || localStorage.getItem('senime_supabase_anon_key') || ''
  };
};

export const saveSupabaseCredentials = (url, key) => {
  localStorage.setItem('senime_supabase_url', url.trim());
  localStorage.setItem('senime_supabase_anon_key', key.trim());
  window.location.reload();
};

export const clearSupabaseCredentials = () => {
  localStorage.removeItem('senime_supabase_url');
  localStorage.removeItem('senime_supabase_anon_key');
  window.location.reload();
};

// Initialize client (even with empty credentials to avoid crashing, but auth will check isSupabaseConfigured())
export const supabase = createClient(
  supabaseUrl || 'https://placeholder-project.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);
