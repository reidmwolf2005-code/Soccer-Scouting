// Supabase client — imported by data.js and auth.js.
// Replace the two placeholder values below with your project's URL and anon key
// (Supabase Dashboard → Project Settings → API).
//
// NEVER commit the service_role key here — it bypasses RLS.
// The anon key is safe to ship in front-end code; RLS enforces access control.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL  = 'https://bqhjdxmetwrcyrftefiq.supabase.co';
const SUPABASE_ANON = 'sb_publishable_7Ttsq5MDb1NcEqYKDWJpvA_xZWAvio_';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
