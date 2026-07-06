/**
 * E2E fixture: PeopleTable actions container for CI-runnable tests
 *
 * This page is accessible without authentication (it's under the login route
 * structure) and renders the exact markup and Tailwind classes from
 * PeopleTable.tsx's view-mode actions container, compiled through the project's
 * real Tailwind pipeline. Used by BUGFIX-02 CI-runnable fixture tests.
 */

export default function PeopleTableActionsFixture() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ marginBottom: '2rem', fontSize: '1.5rem', fontWeight: 'bold' }}>
        E2E Fixture: PeopleTable Actions Container
      </h1>

      <div style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ccc' }}>
        <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: '#666' }}>
          This fixture renders the same markup and Tailwind classes as the view-mode actions
          container in components/PeopleTable.tsx at various viewport widths.
        </p>

        <div style={{ border: '1px solid #e5e7eb', padding: '1rem' }}>
          <p style={{ marginBottom: '0.5rem', fontSize: '0.75rem', color: '#999' }}>
            Actions container (flex flex-wrap justify-end gap-2 sm:flex-nowrap):
          </p>

          {/* Exact markup structure from PeopleTable.tsx view-mode actions */}
          <div className="flex flex-wrap justify-end gap-2 sm:flex-nowrap">
            <a
              href="#"
              data-testid="pm-skills-fixture"
              className="flex min-h-[44px] items-center rounded-md border px-3 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Competências
            </a>
            <button
              data-testid="pm-edit-fixture"
              className="min-h-[44px] rounded-md border px-3 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Editar
            </button>
            <button
              data-testid="pm-remove-fixture"
              className="min-h-[44px] rounded-md border px-3 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Remover
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: '1rem', border: '1px solid #ccc', backgroundColor: '#f9fafb' }}>
        <p style={{ fontSize: '0.875rem', color: '#666', margin: '0' }}>
          <strong>Expected behavior:</strong> On desktop (≥640px / sm breakpoint), all three
          buttons render on a single line. On mobile (&lt;640px), buttons wrap onto additional
          lines. Resize your viewport to test.
        </p>
      </div>
    </div>
  );
}
