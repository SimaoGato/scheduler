import { test, expect } from '@playwright/test';

// AC1: a <button> rendered by the shadcn Button component is present on the login page
test('design-system AC1: shadcn Button is rendered on the login page', async ({ page }) => {
  // Unauthenticated requests are redirected to /pt-PT/login where a shadcn Button renders.
  await page.goto('/pt-PT/login');
  // Use getByRole for a specific, future-proof locator that won't collide with
  // other buttons added in later stories.
  const cta = page.getByRole('button', { name: 'Continuar com Google' });
  await expect(cta).toBeVisible();
});

// AC1: navigation uses library component (rendered as <a> inside the nav)
// STORY-10 moved AppHeader into the (app)/ route group — the nav is only present
// when authenticated. These tests cannot run in CI with placeholder credentials.
// Manual verification: log in, navigate to home, confirm nav renders <a> tags
// (no <button><a> nesting) and tap targets meet 44 px minimum at mobile width.
test('design-system AC1: nav contains anchor links (asChild renders button as <a>)', async ({ page }) => {
  test.skip(true, 'Nav lives in (app)/ route group after STORY-10 — requires authentication. Verify manually.');
  await page.goto('/');
  const navLink = page.locator('nav a').first();
  await expect(navLink).toBeVisible();
  const invalidNesting = page.locator('nav button a');
  await expect(invalidNesting).toHaveCount(0);
});

// AC5: nav tap targets are at least 44 px tall on mobile
test('design-system AC5: nav tap targets meet 44 px minimum at mobile width', async ({ page }) => {
  test.skip(true, 'Nav lives in (app)/ route group after STORY-10 — requires authentication. Verify manually.');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const navLink = page.locator('nav a').first();
  await expect(navLink).toBeVisible();
  const box = await navLink.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
});

// Note: the no-horizontal-overflow assertion at 375 px for the *unauthenticated
// login shell* is already covered by e2e/smoke.spec.ts ("responsive shell: no
// horizontal overflow at mobile width"). Do not duplicate it here to avoid
// double-failure noise in CI.
//
// BUGFIX-06 correction: smoke.spec.ts's assertion does NOT cover the
// authenticated app header/nav rendered by AppHeader.tsx/AppNav.tsx above
// (this file's own AC1/AC5 tests just above are skipped for exactly that
// reason — the nav requires auth). That gap previously let a mobile
// header/nav overflow regression ship twice undetected by CI. The
// CI-enforced source of truth for authenticated header/nav overflow and
// layout coherence at 375px/390px is
// e2e-integration/header-nav-mobile-overflow.spec.ts, which runs
// unconditionally on every PR via the `integration-test` CI job against
// real local-Supabase admin/member sessions.
