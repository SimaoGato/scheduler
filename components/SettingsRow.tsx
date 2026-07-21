interface SettingsRowProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

// SettingsRow — shared title/description/control row primitive for the
// Settings page's preferences Card (CHORE-31). Plain function component (no
// hooks, no 'use client' needed — a pass-through wrapper like Card/
// CardHeader), so it renders fine as a Server Component parent of Client
// Component children (DisplayNameForm, LanguageSwitcher, ThemeToggle).
//
// flex-wrap (no flex-shrink-0 anywhere) — CHORE-29's documented card-list-row
// landmine/fix, applied proactively so a row's control wraps onto its own
// line at narrow viewports instead of overflowing.
export default function SettingsRow({ title, description, children }: SettingsRowProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}
