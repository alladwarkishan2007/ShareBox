import { createClient } from '@supabase/supabase-js';

// Hardcoded Supabase credentials as requested
export const SUPABASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL)
  || 'https://kzmxixjtcygqbogcffge.supabase.co';

export const SUPABASE_ANON_KEY = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY)
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6bXhpeGp0Y3lncWJvZ2NmZmdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwOTA5NTksImV4cCI6MjEwODY2Njk1OX0.0xB_r30ZkEnu_C5ja9gri9KEakbhxyIR2mAA0G1M1-c';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
});

export default supabase;
