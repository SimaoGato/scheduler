import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { Link } from '@/i18n/navigation';
import { getSessionUser, getUserRole } from '@/lib/auth/session';

/**
 * /[locale]/admin/manage — Mobile-only hub page (Server Component) that
 * collapses the admin-only destinations (Team, Roles, Users) into full-width
 * card link rows. CHORE-22: this is the destination of BottomNav's Manage
 * tab on mobile; on desktop the same destinations are already reachable via
 * AppNav's inline links (hidden on mobile since this chore).
 *
 * Belt-and-suspenders auth guard (CLAUDE.md §Per-page admin guard convention):
 *   1. proxy.ts already redirects unauthenticated visitors before this renders.
 *   2. This page additionally checks the user's role so a Member who somehow
 *      reaches this URL is redirected to the home page with ?denied=1.
 *
 * Auth checks come BEFORE getTranslations (lazy-load rule: do not pay for
 * translation namespaces on short-circuit paths). Pattern:
 * session → role → getTranslations → data.
 *
 * Card titles reuse Nav.people/Nav.roles/Nav.userManagement (i18n hygiene:
 * don't duplicate strings that already exist for the same destinations) —
 * only the descriptions are new (Manage.*).
 */
export default async function AdminManagePage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(`/${routing.defaultLocale}/login`);
  }

  const role = await getUserRole(user.id);

  if (role !== 'admin') {
    redirect(`/${routing.defaultLocale}/?denied=1`);
  }

  const t = await getTranslations('Manage');
  const nav = await getTranslations('Nav');

  const links = [
    { href: '/admin/people', title: nav('people'), description: t('teamDescription') },
    { href: '/admin/roles', title: nav('roles'), description: t('rolesDescription') },
    { href: '/admin/users', title: nav('userManagement'), description: t('usersDescription') },
  ] as const;

  return (
    <main className="flex-1 container mx-auto px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">{t('title')}</h1>
      <ul className="flex flex-col gap-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="flex min-h-[44px] items-center justify-between gap-3 rounded-lg border p-4 transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <span>
                <span className="block font-semibold">{link.title}</span>
                <span className="block text-sm text-muted-foreground">{link.description}</span>
              </span>
              <span aria-hidden="true">&rarr;</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
