'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';

interface Props {
  initialDisplayName: string;
  googleNamePlaceholder: string;
}

/**
 * DisplayNameForm — self-service editable name field on the settings page
 * (STORY-21).
 *
 * - `value` starts at the DB display_name (may be empty — AC2: never
 *   pre-filled/auto-saved from the Google name).
 * - `placeholder` is the Google name, shown only while the input is empty.
 * - On successful save, syncs local state to the server's trimmed value
 *   (from the PATCH response body), shows an inline transient success
 *   message, and calls router.refresh() so the persistent AppHeader/
 *   UserWidgetMenu (same route group, not remounted on navigation) re-fetch
 *   the new name without a full page reload (AC3).
 */
export default function DisplayNameForm({ initialDisplayName, googleNamePlaceholder }: Props) {
  const t = useTranslations('Settings');
  const router = useRouter();

  const [value, setValue] = useState(initialDisplayName);
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auto-clear the transient success confirmation after a few seconds — it
  // must not depend on the user reopening the account menu or on viewport
  // width to be seen (WARNING fix: inline confirmation on the settings page
  // itself).
  useEffect(() => {
    if (status !== 'success') return;
    const timer = setTimeout(() => setStatus('idle'), 3000);
    return () => clearTimeout(timer);
  }, [status]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // AC4: reject blank/whitespace-only names client-side before hitting the
    // network — the server still enforces this independently.
    if (!value.trim()) {
      setStatus('error');
      setErrorMessage(t('errorEmpty'));
      return;
    }

    setStatus('saving');
    setErrorMessage(null);

    try {
      const response = await fetch('/api/settings/display-name', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: value }),
      });

      if (response.ok) {
        const body = (await response.json()) as { displayName: string };
        // Sync the input to the actual persisted (trimmed) value, not the
        // pre-save untrimmed one.
        setValue(body.displayName);
        setStatus('success');
        router.refresh();
      } else if (response.status === 400) {
        setStatus('error');
        setErrorMessage(t('errorEmpty'));
      } else {
        setStatus('error');
        setErrorMessage(t('errorGeneric'));
      }
    } catch {
      setStatus('error');
      setErrorMessage(t('errorGeneric'));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-sm">
      <label htmlFor="display-name-input" className="text-sm font-medium">
        {t('nameLabel')}
      </label>
      <input
        id="display-name-input"
        data-testid="display-name-input"
        type="text"
        value={value}
        placeholder={googleNamePlaceholder}
        aria-label={t('nameLabel')}
        onChange={(e) => {
          setValue(e.target.value);
          if (status !== 'idle') setStatus('idle');
        }}
        className="min-h-[44px] rounded-md border px-3 py-2 text-sm"
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          data-testid="display-name-save"
          disabled={status === 'saving'}
          className="min-h-[44px] rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 cursor-pointer"
        >
          {status === 'saving' ? t('savingLabel') : t('saveButton')}
        </button>
        {status === 'success' && (
          <p data-testid="display-name-success" aria-live="polite" className="text-sm text-muted-foreground">
            {t('successMessage')}
          </p>
        )}
        {status === 'error' && errorMessage && (
          <p data-testid="display-name-error" aria-live="polite" className="text-sm text-destructive">
            {errorMessage}
          </p>
        )}
      </div>
    </form>
  );
}
