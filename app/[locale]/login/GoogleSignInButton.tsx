'use client';

import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

interface GoogleSignInButtonProps {
  label: string;
}

export default function GoogleSignInButton({ label }: GoogleSignInButtonProps) {
  async function handleSignIn() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <Button
      onClick={handleSignIn}
      className="min-h-[44px] w-full sm:w-auto"
    >
      {label}
    </Button>
  );
}
