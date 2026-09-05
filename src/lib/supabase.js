// ============================================================
// PERLLON — Supabase client (shared, single source of config)
// ============================================================
// Uses ONLY the public `anon` key. RLS on the server enforces every
// access rule; this client is safe to ship in the browser bundle.
//
// The client is created lazily/defensively so the public site still
// renders (with a graceful "catalog unavailable" state) when env vars
// are not configured yet — this keeps the existing prototype intact.

let client = null;

function getConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon || url.includes('YOUR-PROJECT') || anon.includes('YOUR-ANON')) {
    return null;
  }
  return { url, anon };
}

export function isSupabaseConfigured() {
  return getConfig() !== null;
}

// Returns the shared Supabase client, or null when unconfigured.
// Uses dynamic import so we never fail the whole bundle if the SDK
// isn't installed yet (keeps the existing site runnable without dep).
export async function getSupabase() {
  if (client) return client;
  const cfg = getConfig();
  if (!cfg) return null;
  const { createClient } = await import('@supabase/supabase-js');
  client = createClient(cfg.url, cfg.anon, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}

export { getConfig };