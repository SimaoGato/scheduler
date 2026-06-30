'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

interface GoogleSignInButtonProps {
  label: string;
  errorDefaultLabel: string;
}

export default function GoogleSignInButton({ label, errorDefaultLabel }: GoogleSignInButtonProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSignIn() {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setErrorMessage(errorDefaultLabel);
    }
  }

  return (
    <>
      <Button
        onClick={handleSignIn}
        data-testid="google-signin-button"
        className="min-h-[44px] w-full sm:w-auto"
      >
        {label}
      </Button>
      {errorMessage && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {errorMessage}
        </p>
      )}
    </>
  );
}
