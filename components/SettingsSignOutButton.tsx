'use client';

import { useSignOut } from '@/lib/auth/use-sign-out';
import { Button } from '@/components/ui/button';

interface Props {
  label: string;
  signOutAction: () => Promise<void>;
}

// SettingsSignOutButton — full-width, destructive-outline sign-out entry
// point on the Settings page (CHORE-31, AC3). Reuses the exact STORY-15
// marker-cookie sign-out flow via useSignOut — does not fork it. This is a
// second entry point alongside the header avatar menu's existing sign-out
// (UserWidgetMenu.tsx); that entry is untouched (AC4).
//
// PLACEMENT CONSTRAINT: must render as a direct sibling of the page's Cards
// (on --background), never nested inside a CardContent — the
// destructiveOutline variant's --destructive-outline token is only
// contrast-verified against --background (see globals.css's comment).
export default function SettingsSignOutButton({ label, signOutAction }: Props) {
  const handleSignOut = useSignOut(signOutAction);

  return (
    <Button
      type="button"
      variant="destructiveOutline"
      onClick={handleSignOut}
      data-testid="settings-sign-out-button"
      className="w-full min-h-[44px]"
    >
      {label}
    </Button>
  );
}
