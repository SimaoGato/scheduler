'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from '@/i18n/navigation';

interface Props {
  displayName: string;
  initial: string;
  roleLabel: string | null;
  triggerAriaLabel: string;
  signOutLabel: string;
  signOutAction: () => Promise<void>;
}

export default function UserWidgetMenu({
  displayName,
  initial,
  roleLabel,
  triggerAriaLabel,
  signOutLabel,
  signOutAction,
}: Props) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const triggerRef = useRef<HTMLElement>(null);
  const router = useRouter();

  // STORY-15: makes sign-out feel instant by navigating to /login before
  // the server-side signOut() round trip completes, instead of waiting on
  // it.
  //
  // WHY the marker cookie exists (do not "simplify" this away): setting
  // `app-signout-pending=1` synchronously, before router.push, forces
  // proxy.ts's auth guard to treat this browser as signed-out immediately.
  // Without it, proxy.ts's reverse-guard (`user && isLoginPath`) would
  // bounce the /login navigation straight back to / for as long as the
  // real (still in-flight, unawaited) supabase.auth.signOut() call hasn't
  // yet cleared the actual session cookie — the real cookie is never
  // cleared synchronously, only after its own network round trip resolves.
  // The 15s max-age bounds how long a hung/failed real signOut() (see
  // actions.ts's try/catch + console.error) can keep the guard in this
  // stricter treatment. See proxy.ts for the read side and
  // app/auth/callback/route.ts for where the marker is cleared again on the
  // next successful login.
  function handleSignOut() {
    document.cookie = 'app-signout-pending=1; path=/; max-age=15; SameSite=Lax; Secure';
    router.push('/login');
    void signOutAction().catch((err) => {
      console.error('[UserWidgetMenu] signOutAction invocation error:', err);
    });
  }

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
        className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-md border bg-background shadow-md"
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
