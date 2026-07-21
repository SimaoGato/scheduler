'use client';

import { useEffect, useRef } from 'react';
import { Link } from '@/i18n/navigation';
import { useSignOut } from '@/lib/auth/use-sign-out';

interface Props {
  displayName: string;
  initial: string;
  roleLabel: string | null;
  triggerAriaLabel: string;
  settingsLabel: string;
  signOutLabel: string;
  signOutAction: () => Promise<void>;
}

export default function UserWidgetMenu({
  displayName,
  initial,
  roleLabel,
  triggerAriaLabel,
  settingsLabel,
  signOutLabel,
  signOutAction,
}: Props) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const triggerRef = useRef<HTMLElement>(null);

  // STORY-15's marker-cookie sign-out sequence lives in useSignOut
  // (lib/auth/use-sign-out.ts), extracted there (CHORE-31) so
  // components/SettingsSignOutButton.tsx can reuse it verbatim. See that
  // file for the full "why the marker cookie exists" explanation.
  const handleSignOut = useSignOut(signOutAction);

  useEffect(() => {
    // Outside-click dismissal.
    //
    // IMPORTANT: this listener is attached on the bubble-phase 'click' event
    // (NOT 'mousedown', NOT { capture: true }). <summary>'s native toggle of
    // the <details> `open` attribute happens as the click event's *default
    // action*, which runs after bubble-phase listeners have executed. That
    // ordering is what lets AC2/AC3 (trigger click still opens/closes the
    // menu) keep working: this handler only ever force-closes an already-open
    // menu when the click target is outside the <details> node, so it never
    // fights the browser's own open/close toggle on the trigger. Switching to
    // 'mousedown' or a capturing listener would run this logic *before* the
    // native toggle and reintroduce a race/regression here — do not "fix"
    // this to mousedown/capture.
    function handleClick(event: MouseEvent) {
      const details = detailsRef.current;
      if (!details || !details.open) return;
      if (event.target instanceof Node && details.contains(event.target)) return;
      details.open = false;
    }

    function handleKeyDown(event: KeyboardEvent) {
      const details = detailsRef.current;
      if (!details || !details.open) return;
      if (event.key !== 'Escape') return;
      details.open = false;
      // Return focus to the trigger, per ARIA APG disclosure-widget practice.
      triggerRef.current?.focus();
    }

    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <details ref={detailsRef} data-testid="user-widget" className="relative">
      <summary
        ref={triggerRef}
        aria-label={triggerAriaLabel}
        data-testid="user-widget-trigger"
        className="list-none cursor-pointer flex items-center gap-2 min-h-[44px] px-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden"
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium"
        >
          {initial}
        </span>
        <span className="hidden sm:block text-sm">{displayName}</span>
      </summary>

      <div
        // CHORE-28 Design decision 3: the header sets text-header-foreground
        // (near-white) on <header>, and `color` inherits through the DOM
        // regardless of this panel's own bg-background (light/white in
        // light theme) — without this explicit reset the panel would render
        // near-white text on a near-white surface. Required fix, not
        // optional polish.
        className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-md border bg-background text-foreground shadow-md"
        data-testid="user-widget-menu"
      >
        <div className="px-3 py-2">
          <p className="text-sm font-medium" data-testid="user-identity">
            {displayName}
          </p>
          {roleLabel && (
            <p className="text-xs text-muted-foreground" data-testid="user-role-label">
              {roleLabel}
            </p>
          )}
        </div>
        <div className="border-t" />
        <div className="p-1">
          <Link
            href="/settings"
            data-testid="settings-link"
            onClick={() => {
              // STORY-21: /settings is inside the same (app)/ route group as
              // /, so client-side navigation does not remount this layout
              // (unlike sign-out, which navigates to /login outside the
              // group). Explicitly close the menu before navigating —
              // mirrors the Escape handler's `details.open = false` below.
              if (detailsRef.current) detailsRef.current.open = false;
            }}
            className="w-full min-h-[44px] flex items-center px-3 py-2 text-sm rounded-md hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors"
          >
            {settingsLabel}
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            data-testid="sign-out-button"
            className="w-full min-h-[44px] flex items-center px-3 py-2 text-sm rounded-md hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors"
          >
            {signOutLabel}
          </button>
        </div>
      </div>
    </details>
  );
}
