import { getTranslations } from 'next-intl/server';
import { signOut } from '@/app/[locale]/login/actions';

interface Props {
  displayName: string;
  roleLabel: string | null;
}

export default async function UserWidget({ displayName, roleLabel }: Props) {
  const t = await getTranslations('Auth');
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <details data-testid="user-widget" className="relative">
      <summary
        aria-label={`${displayName} — ${t('userMenuAriaLabel')}`}
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
        <form action={signOut} className="p-1">
          <button
            type="submit"
            data-testid="sign-out-button"
            className="w-full min-h-[44px] flex items-center px-3 py-2 text-sm rounded-md hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors"
          >
            {t('signOut')}
          </button>
        </form>
      </div>
    </details>
  );
}
