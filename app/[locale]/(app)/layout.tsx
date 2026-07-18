/**
 * Route-group layout for authenticated app pages.
 *
 * This layout covers all routes under (app)/ — i.e. /, /admin/users,
 * /admin/people — and mounts AppHeader plus the flex shell wrapper.
 *
 * IMPORTANT: Any new [locale]/ page added OUTSIDE of (app)/ or login/ will
 * have no flex wrapper and no AppHeader. Put new authenticated pages inside
 * (app)/ to inherit this layout automatically.
 *
 * CHORE-22: mounts BottomNav (mobile-only fixed tab bar) right after
 * <AppHeader /> and BEFORE {children} — deliberately not last. The bar is
 * `position: fixed`, so its DOM position has zero effect on where it's
 * painted, but it has a real effect on keyboard tab order: placing it after
 * {children} would force a keyboard user to Tab through every piece of page
 * content before ever reaching primary navigation. Placing it second makes
 * it reachable in a small, bounded number of Tab presses regardless of page
 * content length (see e2e-integration/mobile-bottom-nav.spec.ts AC6).
 *
 * Also calls getUserProfile(user.id) — the same function AppHeader.tsx
 * already calls with the same argument (not getUserRole()) — so both
 * cache()-wrapped calls dedupe to zero extra Supabase round-trips on every
 * (app) route, not just the routes that happened to already call
 * getUserRole.
 */
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import { getSessionUser, getUserProfile } from '@/lib/auth/session';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();

  let role: 'admin' | 'member' | null = null;
  if (user) {
    const profile = await getUserProfile(user.id);
    role = profile?.role ?? null;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <BottomNav role={role} />
      {/* CHORE-22: bottom padding (mockup: 110px) so the fixed mobile bar
          never covers page content; also honors env(safe-area-inset-bottom).
          Tailwind v4 arbitrary values encode literal spaces as `_`; calc()
          requires whitespace around `+`, so this must be
          `calc(110px_+_env(safe-area-inset-bottom))`, not
          `calc(110px+env(safe-area-inset-bottom))` (invalid calc). No padding
          needed at >=sm, where the bar is hidden. */}
      <div className="flex-1 pb-[calc(110px_+_env(safe-area-inset-bottom))] sm:pb-0">
        {children}
      </div>
    </div>
  );
}
