/**
 * Route-group layout for authenticated app pages.
 *
 * This layout covers all routes under (app)/ — i.e. /, /admin/users,
 * /admin/people — and mounts AppHeader plus the flex shell wrapper.
 *
 * IMPORTANT: Any new [locale]/ page added OUTSIDE of (app)/ or login/ will
 * have no flex wrapper and no AppHeader. Put new authenticated pages inside
 * (app)/ to inherit this layout automatically.
 */
import AppHeader from '@/components/AppHeader';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      {children}
    </div>
  );
}
