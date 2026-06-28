import 'server-only';

import { createClient } from '@supabase/supabase-js';

/**
 * createServiceClient — returns a Supabase client that uses the service-role
 * key, which bypasses Row Level Security entirely. This must only ever be called
 * from server-side code (Route Handlers, Server Actions).
 *
 * The client is created lazily inside the function (not at module level) so that
 * missing env vars do not throw at module-load time in CI builds.
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
