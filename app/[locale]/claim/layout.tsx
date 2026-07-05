/**
 * /[locale]/claim layout — no-nav shell (STORY-11).
 *
 * Copies login/layout.tsx's centering wrapper. /claim is a one-time, forced
 * onboarding interstitial immediately after first login — structurally the
 * same kind of full-screen decision gate as /login, not a page users
 * navigate to/from via nav, so it lives outside the (app)/ route group and
 * does not render AppHeader/AppNav.
 */
export default function ClaimLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-muted/50 px-4"
      data-testid="claim-centering-root"
    >
      {children}
    </div>
  );
}
