import { afterEach, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: sdk.createClient }));

afterEach(() => {
  vi.unstubAllEnvs();
  sdk.createClient.mockReset();
});

it('shares one Supabase client across concurrent callers', async () => {
  vi.resetModules();
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-test-key');
  const client = { id: 'singleton' };
  sdk.createClient.mockReturnValue(client);
  const { getSupabase } = await import('../../src/lib/supabase.js');
  const concurrent = Array.from({ length: 20 }, () => getSupabase());
  expect(concurrent.every((promise) => promise === concurrent[0])).toBe(true);
  expect(await Promise.all(concurrent)).toEqual(Array(20).fill(client));
  expect(sdk.createClient).toHaveBeenCalledTimes(1);
  expect(await getSupabase()).toBe(client);
});

it('does not create a client without public configuration', async () => {
  vi.resetModules();
  vi.stubEnv('VITE_SUPABASE_URL', 'https://YOUR-PROJECT.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'YOUR-ANON-PUBLISHABLE-KEY');
  const { getSupabase, isSupabaseConfigured } = await import('../../src/lib/supabase.js');
  expect(isSupabaseConfigured()).toBe(false);
  expect(await getSupabase()).toBeNull();
  expect(sdk.createClient).not.toHaveBeenCalled();
});
