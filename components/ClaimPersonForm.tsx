'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';

interface PersonOption {
  id: string;
  name: string;
}

interface Props {
  people: PersonOption[];
}

const ERROR_CODE_KEYS: Record<string, string> = {
  already_claimed: 'errorAlreadyClaimed',
  already_linked: 'errorAlreadyLinked',
};

/**
 * ClaimPersonForm — radio list of unlinked person records + Confirm/Skip
 * buttons (STORY-11).
 *
 * - Radio inputs are grouped in a <fieldset><legend> so assistive tech
 *   announces them as one question (WCAG SC 1.3.1), not a flat list of
 *   unrelated labeled inputs.
 * - Confirm is disabled until a selection is made.
 * - On success, navigates home via router.push('/') (matches
 *   UserWidgetMenu/DisplayNameForm precedent).
 * - On 409, maps the error code to an i18n message so the user can pick
 *   another name or skip — the form is not dead-ended by a conflict.
 * - Skip performs no fetch call — client-only navigation home.
 */
export default function ClaimPersonForm({ people }: Props) {
  const t = useTranslations('Claim');
  const router = useRouter();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function mapErrorCode(code: unknown): string {
    const key = typeof code === 'string' ? ERROR_CODE_KEYS[code] : undefined;
    return t(key ?? 'errorGeneric');
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;

    setStatus('saving');
    setErrorMessage(null);

    try {
      const response = await fetch('/api/people/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person_id: selectedId }),
      });

      if (response.ok) {
        router.push('/');
        return;
      }

      const errorBody = await response.json().catch(() => ({}));
      setStatus('error');
      setErrorMessage(mapErrorCode(errorBody.error));
    } catch {
      setStatus('error');
      setErrorMessage(t('errorGeneric'));
    }
  }

  function handleSkip() {
    router.push('/');
  }

  return (
    <form onSubmit={handleConfirm} className="flex flex-col gap-6">
      {errorMessage && (
        <div
          data-testid="claim-error"
          aria-live="polite"
          className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {errorMessage}
        </div>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t('instructions')}</legend>
        <div data-testid="claim-person-list" className="flex flex-col gap-2">
          {people.map((person) => (
            <label
              key={person.id}
              className="flex min-h-[44px] items-center gap-3 rounded-md border px-3 py-2 text-sm hover:bg-accent"
            >
              <input
                type="radio"
                name="claim-person"
                value={person.id}
                checked={selectedId === person.id}
                onChange={() => setSelectedId(person.id)}
                disabled={status === 'saving'}
              />
              {person.name}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          data-testid="claim-confirm"
          disabled={!selectedId || status === 'saving'}
          className="min-h-[44px] rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 cursor-pointer"
        >
          {status === 'saving' ? t('confirming') : t('confirmButton')}
        </button>
        <button
          type="button"
          data-testid="claim-skip"
          onClick={handleSkip}
          disabled={status === 'saving'}
          className="min-h-[44px] rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('skipButton')}
        </button>
      </div>
    </form>
  );
}
