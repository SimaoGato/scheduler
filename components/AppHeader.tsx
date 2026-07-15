import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import AppNav from './AppNav';
import UserWidget from './UserWidget';
import { getSessionUser, getUserProfile } from '@/lib/auth/session';

export default async function AppHeader() {
  const t = await getTranslations('App');
  const tAuth = await getTranslations('Auth');

  const user = await getSessionUser();

  let role: 'admin' | 'member' | null = null;
  let roleLabel: string | null = null;
  let displayName: string = tAuth('userFallback');
  if (user) {
    // STORY-21/AC6: public.users.display_name is the source of truth for the
    // displayed name — do not read user.user_metadata directly here. Falls
    // back to the Google name, then email, then the generic fallback only
    // when the DB value is empty.
    const profile = await getUserProfile(user.id);
    role = profile?.role ?? null;
    // Reusing UserManagement.roleAdmin / UserManagement.roleMember to avoid
    // duplicating strings that are semantically identical. NOTE 1, STORY-06.
    const tUM = await getTranslations('UserManagement');
    roleLabel =
      role === 'admin'
        ? tUM('roleAdmin')
        : role === 'member'
          ? tUM('roleMember')
          : null;

    const googleName =
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      '';
    displayName =
      profile?.displayName && profile.displayName !== ''
        ? profile.displayName
        : googleName || user.email || tAuth('userFallback');
  }

  return (
    <header className="border-b bg-background px-4 py-3">
      <div className="container mx-auto flex flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-4">
        <Link
          href="/"
          className="inline-flex items-center min-h-[44px] text-lg font-semibold shrink-0"
        >
          {t('name')}
        </Link>
        {/* DOM order is Link -> avatar -> nav, matching the mobile (<sm) visual
            order exactly, so keyboard tab order and screen-reader reading order
            match what's on screen at the default (mobile-first) breakpoint —
            no CSS `order` at all is used for the mobile case. `ml-auto` here
            (unprefixed) pins the avatar to the right edge of row 1, next to the
            logo. At >=sm, sm:order-3 + sm:ml-0 move it back after the nav to
            restore the exact pre-fix desktop grouping (see BUGFIX-06 for why
            this is load-bearing — do not remove without re-verifying 375px,
            390px, AND 1280px, and re-checking tab order with a real keyboard).

            ACCEPTED RISK (BUGFIX-06 cycle 2, precedent: CLAUDE.md's STORY-18
            TOCTOU-acceptance pattern): at >=sm this override makes DOM order
            (Link -> avatar -> nav) diverge from visual order (Link -> nav ->
            avatar) — a desktop keyboard user tabs to the avatar/user-menu
            BEFORE the nav links, opposite of on-screen left-to-right order.
            This is deliberate, not missed: the visual order genuinely differs
            between breakpoints (mobile wants avatar-then-nav, desktop wants
            nav-then-avatar), so a single DOM order can match only one
            breakpoint's default visual order without duplicating the
            AppNav/UserWidget subtree (rejected — see the cycle-2 revision
            note above: UserWidgetMenu's fixed data-testid values would
            collide across 7 existing E2E_WITH_AUTH-gated specs). Mobile was
            chosen as the bug-free breakpoint because it's this bugfix's
            actual subject. The desktop divergence blocks no action and
            creates no keyboard trap — every element stays reachable, just in
            a non-visual order. Do not "fix" this by adding order-* at mobile
            instead; that reintroduces the original CRITICAL #1 regression on
            the breakpoint this bugfix exists to repair. */}
        {user && (
          <div className="ml-auto sm:order-3 sm:ml-0">
            <UserWidget displayName={displayName} roleLabel={roleLabel} />
          </div>
        )}
        {/* Mobile (<sm): no order override — this div is the third DOM child so
            it naturally renders as row 2+, full width, wrapping its own <ul>
            across the whole container width instead of a squeezed sub-column —
            this is the fix. Desktop (>=sm): sm:order-2 + sm:ml-auto move it
            back between the logo and the avatar, restoring the current tight
            right-hand grouping. */}
        <div className="w-full min-w-0 sm:order-2 sm:w-auto sm:ml-auto">
          <AppNav role={role} />
        </div>
      </div>
    </header>
  );
}
