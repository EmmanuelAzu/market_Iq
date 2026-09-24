/** True once the Supabase env vars exist (e.g. after linking the Supabase ↔ Vercel integration). */
export const supabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
