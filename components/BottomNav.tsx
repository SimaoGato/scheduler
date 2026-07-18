'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

interface Props {
  role: 'admin' | 'member' | null;
}

// CHORE-22: reuses CHORE-28's header-aware focus ring — same surface
// (--header), same landmine the shared Button base's default `ring-ring/50`
// would hit. These tabs are plain <Link>s (not the shadcn Button primitive —
// the icon-less two-line flex-col label+indicator shape doesn't fit Button's
// pill-shaped variants), so the override is applied directly here rather than
// inherited from Button.
const HEADER_AWARE_FOCUS_RING = 'focus-visible:ring-header-foreground';

interface Tab {
  href: string;
  label: string;
  isActive: (pathname: string) => boolean;
}

export default function BottomNav({ role }: Props) {
  const t = useTranslations('Nav');
  const tAuth = useTranslations('Auth');
  const pathname = usePathname(); // locale-agnostic, e.g. "/admin/people"

  // STORY-16 "return null when empty" convention (same guard AppNav.tsx has):
  // never render an empty landmark for a null/unrecognized role.
  if (role !== 'admin' && role !== 'member') return null;

  const tabs: Tab[] = [
    // Home's matcher is deliberately exact-only, not the AppNav prefix
    // pattern: '/' is a prefix of every path, so startsWith('/') would make
    // Home permanently "active" everywhere. This is the one place this
    // component's active-matching must diverge from AppNav.tsx's helper.
    { href: '/', label: t('home'), isActive: (p) => p === '/' },
    {
      href: '/availability',
      label: t('availability'),
      isActive: (p) => p === '/availability' || p.startsWith('/availability/'),
    },
    ...(role === 'admin'
      ? [
          {
            href: '/admin/manage',
            label: t('manage'),
            // Manage's matcher ORs in /admin/people, /admin/roles,
            // /admin/users prefixes (covering their sub-routes too, e.g.
            // /admin/people/[id]/skills) — AC2's "Team/Roles/Users mapping
            // to the Manage tab" requirement, verbatim.
            isActive: (p: string) =>
              p === '/admin/manage' ||
              p.startsWith('/admin/manage/') ||
              p.startsWith('/admin/people') ||
              p.startsWith('/admin/roles') ||
              p.startsWith('/admin/users'),
          },
        ]
      : []),
    {
      href: '/settings',
      label: tAuth('settingsLink'),
      isActive: (p) => p === '/settings',
    },
  ];

  return (
    <nav
      aria-label={t('ariaLabel')}
      className="fixed inset-x-0 bottom-0 z-50 flex items-stretch justify-around border-t border-header-border bg-header px-1.5 pt-2 pb-[calc(8px_+_env(safe-area-inset-bottom))] sm:hidden"
    >
      {tabs.map((tab) => {
        const active = tab.isActive(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-h-[48px] flex-1 flex-col items-center justify-center gap-1 text-xs font-semibold',
              HEADER_AWARE_FOCUS_RING,
              active ? 'text-brand' : 'text-header-muted'
            )}
          >
            <span
              aria-hidden="true"
              className={cn('h-1 w-5 rounded-full', active ? 'bg-brand' : 'bg-transparent')}
            />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
