import { getTranslations } from 'next-intl/server';
import { signOut } from '@/app/[locale]/login/actions';
import UserWidgetMenu from '@/components/UserWidgetMenu';

interface Props {
  displayName: string;
  roleLabel: string | null;
}

export default async function UserWidget({ displayName, roleLabel }: Props) {
  const t = await getTranslations('Auth');
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <UserWidgetMenu
      displayName={displayName}
      initial={initial}
      roleLabel={roleLabel}
      triggerAriaLabel={`${displayName} — ${t('userMenuAriaLabel')}`}
      signOutLabel={t('signOut')}
      signOutAction={signOut}
    />
  );
}
