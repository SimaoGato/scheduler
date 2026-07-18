'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  role: 'admin' | 'member' | null;
}

// CHORE-28 Design decision 4: the active nav item must override ghost's
// hover:bg-accent so it stays on --brand on hover, not flash to --accent.
// Matches every modifier the ghost variant declares (`hover:` AND
// `dark:hover:`) rather than relying on CSS cascade specificity — per the
// BUGFIX-03 checked/selected-state precedent, twMerge treats differing
// modifier stacks as different slots and does not dedupe across them.
const ACTIVE_NAV_ITEM_CLASSES =
  'bg-brand text-brand-foreground hover:bg-brand hover:text-brand-foreground dark:hover:bg-brand dark:hover:text-brand-foreground';

// CHORE-28 PR #59 review (CRITICAL fix): the shared Button base's
// `focus-visible:ring-ring/50` draws directly against the new --header
// background. --ring is near-black in light theme (240 5.9% 10%) and
// --header is also near-black (210 52% 11%) in light theme — measured
// (HSL->sRGB->luminance->ratio, same method as globals.css's other
// pairings) at ~1.03:1, far below the WCAG 2.4.11/1.4.11 3:1 floor for
// focus indicators. (Dark theme's --ring flips to near-white, ~12.2:1
// against --header, so it isn't broken there.)
//
// Verified via computed-style + compiled-CSS inspection: none of these
// Buttons declare a `ring-offset-*` class, so `--tw-ring-offset-width`
// defaults to 0px and the ring's box-shadow starts flush at the border
// edge with no offset gap. That means the ring paints entirely OUTSIDE
// the button's own border-box, against whatever surface surrounds it —
// which is --header for BOTH inactive (transparent/ghost) AND active
// (bg-brand) nav items alike; the active item's own brand fill never
// shows "behind" the ring. This override is therefore applied to all
// four links uniformly, not just the inactive ones.
//
// --header-foreground is reused as the ring color (already verified
// 16.38:1 light / 16.12:1 dark against --header in globals.css) —
// comfortably clears the 3:1 non-text WCAG floor in both themes, so no
// new token is needed. twMerge correctly drops the base's
// `ring-ring/50` in favor of this override (same `ring-{color}` class
// group, this one ordered later via cn()) — verified against this
// repo's actual tailwind-merge config, no cva/twMerge landmine.
const HEADER_AWARE_FOCUS_RING = 'focus-visible:ring-header-foreground';

export default function AppNav({ role }: Props) {
  const t = useTranslations('Nav');
  const pathname = usePathname(); // locale-agnostic, e.g. "/admin/people"

  // Prefix match, not exact-only: /admin/people has sub-routes
  // (/admin/people/[id]/availability, /admin/people/[id]/skills) that must
  // still mark "Equipa" active. Applied uniformly to all four links for
  // consistency, even though only /admin/people has sub-routes today.
  //
  // Risk (documented, not an issue today): this could over-match if a
  // future nav href becomes a prefix of another nav href (e.g. a
  // hypothetical /admin and /admin/roles both as nav items) — all four
  // current hrefs are mutually non-prefixing, so this is safe as-is.
  function isActive(href: string): boolean {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  // STORY-26: Availability is the first Member-facing nav item; the empty-
  // landmark rule (STORY-16) still applies for a null/unrecognized role
  // (e.g. a provisioning-failure edge case).
  if (role !== 'admin' && role !== 'member') return null;
  return (
    <nav aria-label={t('ariaLabel')} className="min-w-0">
      <ul className="flex flex-wrap justify-end gap-1">
        <li>
          <Button
            variant="ghost"
            asChild
            className={cn(
              'min-h-[44px] px-3 text-sm',
              HEADER_AWARE_FOCUS_RING,
              isActive('/availability') && ACTIVE_NAV_ITEM_CLASSES
            )}
          >
            <Link
              href="/availability"
              aria-current={isActive('/availability') ? 'page' : undefined}
            >
              {t('availability')}
            </Link>
          </Button>
        </li>
        {role === 'admin' && (
          <>
            <li>
              <Button
                variant="ghost"
                asChild
                className={cn(
                  'min-h-[44px] px-3 text-sm',
                  HEADER_AWARE_FOCUS_RING,
                  isActive('/admin/users') && ACTIVE_NAV_ITEM_CLASSES
                )}
              >
                <Link
                  href="/admin/users"
                  aria-current={isActive('/admin/users') ? 'page' : undefined}
                >
                  {t('userManagement')}
                </Link>
              </Button>
            </li>
            <li>
              <Button
                variant="ghost"
                asChild
                className={cn(
                  'min-h-[44px] px-3 text-sm',
                  HEADER_AWARE_FOCUS_RING,
                  isActive('/admin/people') && ACTIVE_NAV_ITEM_CLASSES
                )}
              >
                <Link
                  href="/admin/people"
                  aria-current={isActive('/admin/people') ? 'page' : undefined}
                >
                  {t('people')}
                </Link>
              </Button>
            </li>
            <li>
              <Button
                variant="ghost"
                asChild
                className={cn(
                  'min-h-[44px] px-3 text-sm',
                  HEADER_AWARE_FOCUS_RING,
                  isActive('/admin/roles') && ACTIVE_NAV_ITEM_CLASSES
                )}
              >
                <Link
                  href="/admin/roles"
                  aria-current={isActive('/admin/roles') ? 'page' : undefined}
                >
                  {t('roles')}
                </Link>
              </Button>
            </li>
          </>
        )}
      </ul>
    </nav>
  );
}
