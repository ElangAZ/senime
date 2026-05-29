import { createClient } from '@supabase/supabase-js';

// Safe localStorage helper to prevent crashes in private windows / strict browsers
const getSafeLocalStorage = (key) => {
  try {
    return localStorage.getItem(key) || '';
  } catch (e) {
    console.warn("Storage access blocked:", e);
    return '';
  }
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || getSafeLocalStorage('senime_supabase_url') || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || getSafeLocalStorage('senime_supabase_anon_key') || '';

export const isSupabaseConfigured = () => {
  return supabaseUrl.trim() !== '' && supabaseAnonKey.trim() !== '';
};

export const getSupabaseCredentials = () => {
  return {
    url: supabaseUrl || getSafeLocalStorage('senime_supabase_url') || '',
    key: supabaseAnonKey || getSafeLocalStorage('senime_supabase_anon_key') || ''
  };
};

export const saveSupabaseCredentials = (url, key) => {
  try {
    localStorage.setItem('senime_supabase_url', url.trim());
    localStorage.setItem('senime_supabase_anon_key', key.trim());
  } catch (e) {
    console.error("Failed to save credentials to localStorage:", e);
  }
  window.location.reload();
};

export const clearSupabaseCredentials = () => {
  try {
    localStorage.removeItem('senime_supabase_url');
    localStorage.removeItem('senime_supabase_anon_key');
  } catch (e) {
    console.error("Failed to clear credentials from localStorage:", e);
  }
  window.location.reload();
};

// Initialize client
export const supabase = createClient(
  supabaseUrl || 'https://placeholder-project.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);
