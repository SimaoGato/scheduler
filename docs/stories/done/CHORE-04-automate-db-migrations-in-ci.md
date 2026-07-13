# CHORE-04: Automate database migrations in CI/CD
Epic: maintenance
Status: done ✅
PR: 8

## Task
As the team, we want database migrations to be applied automatically when code
merges to main, so that schema and application code are always in sync and the
manual "paste SQL into Supabase dashboard" step is eliminated.

## Context
Currently there is no Supabase CLI config (`supabase/config.toml`) in the
repository. Every migration (e.g. STORY-03's `users` table) must be manually
copied into the Supabase dashboard SQL Editor after the PR merges. This creates
a window where the deployed code references a table that does not yet exist,
and has already caused friction (missing GRANT, permission denied errors).

CHORE-03 anticipated this: "when `supabase db push` arrives, apply schema to
both dev and prod." This chore makes that happen automatically for production.

## Acceptance criteria
1. Given a migration file under `supabase/migrations/`, when a PR is merged to
   main, then the migration is applied to the production Supabase project via
   `supabase db push` in the GitHub Actions pipeline before the Vercel deploy
   completes.
2. Given a migration that fails (e.g. SQL error), when CI runs, then the
   migrate job fails and the pipeline stops — code is not deployed with a
   broken schema.
3. Given a migration that has already been applied, when CI runs, then
   `supabase db push` is idempotent and the job succeeds (no duplicate
   application).
4. Given the CI pipeline on a PR branch (not main), when CI runs, then the
   migrate job is skipped — only lint, build, and tests run.
5. Given a developer reading `.github/workflows/ci.yml`, when they look at the
   migrate step, then the required GitHub secrets are clearly documented in a
   comment.

## Out of scope
- Applying migrations to a dev/preview Supabase project (CHORE-03 scope).
- Supabase local development via Docker.
- Schema diffing or down-migrations/rollbacks.
- Staging environment.

## Technical notes
- **Supabase CLI init**: Run `supabase init` to create `supabase/config.toml`.
  Set `project_id` to the production project ref.
- **Required GitHub secrets** (add in repo Settings → Secrets):
  - `SUPABASE_ACCESS_TOKEN` — personal access token from supabase.com/dashboard/account/tokens
  - `SUPABASE_PROJECT_REF` — the production project reference ID (found in Supabase Project Settings → General)
  - `SUPABASE_DB_PASSWORD` — the production database password (Supabase Project Settings → Database)
- **CI job structure**: Add a `migrate` job that runs only on `push` to `main`
  (use `if: github.ref == 'refs/heads/main' && github.event_name == 'push'`).
  The job should run after `lint-build-test` passes (use `needs:`).
- **Supabase CLI in CI**: Install via `npm install -g supabase` or the official
  GitHub Action `supabase/setup-cli@v1`.
- **Migration idempotency**: `supabase db push` tracks applied migrations in a
  `supabase_migrations` schema table — already-applied files are skipped
  automatically. The `IF NOT EXISTS` / `DROP POLICY IF EXISTS` guards in our
  migration files provide an extra safety net.
- **Order of operations**: migrate → then Vercel deploys (Vercel auto-deploys
  on push to main; ensure the migrate job completes first, or add a delay, or
  accept the brief window — Vercel deploys typically take 1–2 min which is
  longer than `db push`).
- Do CHORE-03 (separate dev/prod Supabase projects) before or alongside this
  chore, so the dev `.env.local` is not pointing at the prod project while CI
  pushes migrations.

## Definition of Done
See CLAUDE.md, plus:
- `supabase/config.toml` committed to the repository.
- GitHub secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, and
  `SUPABASE_DB_PASSWORD` configured in the repo (manual step, not committed).
- CI migrate job runs on merge to main and is skipped on PR branches.
- Verified by merging a trivial migration (e.g. a comment-only change or an
  `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` no-op) and confirming the job
  passes in GitHub Actions.

---

## Implementation Plan

### Complexity tag

`standard` — touches three files (`.gitignore`, `supabase/config.toml` created,
`.github/workflows/ci.yml` modified) and requires understanding of two
interacting systems: GitHub Actions job orchestration and Supabase CLI
conventions. Not trivial because it introduces a live production deployment
path gated on secrets. Not complex because there is no auth logic, data
integrity reasoning, or concurrency concern within the CI pipeline itself.

---

### Affected areas

- **infra** — `.github/workflows/ci.yml` (new job), `supabase/config.toml`
  (new file), `.gitignore` (one-line addition)
- **data** — indirectly: the `migrate` job applies SQL migrations to the
  production database

No app code (TypeScript, React, CSS, tests) is changed.

---

### Current state

| Item | State |
|------|-------|
| `supabase/` directory | Exists |
| `supabase/migrations/` | Exists — contains `20260628000001_create_users_table.sql` |
| `supabase/config.toml` | **Missing** — must be created |
| `supabase/.temp/` in `.gitignore` | **Missing** — Supabase CLI writes here on `supabase link`; should be ignored |
| CI `migrate` job | **Missing** — must be added |
| GitHub secrets | **Missing** — manual setup required before first merge |

The existing migration file was applied manually via the Supabase SQL Editor
(STORY-03). It will be re-applied by `supabase db push` on the first CI run
because it is not yet tracked in the `supabase_migrations.schema_migrations`
table. This is safe: the SQL uses `CREATE TABLE IF NOT EXISTS` and
`DROP POLICY IF EXISTS ... CREATE POLICY`, both of which are idempotent on
PostgreSQL 15.

---

### Step-by-step approach

**Step 1 — Add `supabase/.temp/` to `.gitignore`**

The Supabase CLI writes a `.temp/` directory under `supabase/` when
`supabase link` is run (stores linked project ref, access token cache, etc.).
Add one line to `.gitignore`:

```
# supabase CLI temp files (created by `supabase link`)
supabase/.temp/
```

**Step 2 — Create `supabase/config.toml`**

Create the file with minimal content. Local Docker development is out of scope
(CHORE-03 / story Out of Scope), so the full local-stack config sections
(`[api]`, `[auth]`, `[studio]`, etc.) are intentionally omitted — they exist
only for `supabase start` (Docker) workflows.

```toml
# Supabase CLI project configuration.
#
# project_id is used for local Supabase CLI operations.
# In CI, the --project-ref flag overrides this value.
# For local use, set this to your dev project ref (see CHORE-03).
project_id = "your-dev-project-ref"

[db]
# Must match the PostgreSQL major version of your remote Supabase project.
# Supabase hosted projects run PostgreSQL 15.
major_version = 15
```

The implementer should replace `"your-dev-project-ref"` with the actual dev
project reference ID before committing, but this is not required for CI
correctness since CI passes `--project-ref` explicitly.

**Step 3 — Update migration file header comment (recommended)**

The `supabase/migrations/20260628000001_create_users_table.sql` header says
"Apply this migration manually." Update the HOW TO APPLY block to say it is
now applied automatically via the `migrate` CI job on merge to main. This
keeps the file's documentation accurate.

**Step 4 — Add `migrate` job to `.github/workflows/ci.yml`**

Append the following job after the closing of `lint-build-test`. The indentation
must be at the same level as `lint-build-test:` (two-space indent under `jobs:`).

```yaml
  migrate:
    runs-on: ubuntu-22.04
    needs: lint-build-test
    # Run only when a PR is merged to main (push event on main branch).
    # Skipped on pull_request events — lint/build/test is sufficient for PRs.
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    steps:
      - uses: actions/checkout@v4

      - uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Apply database migrations
        # Required GitHub secrets (repo Settings → Secrets and variables → Actions):
        #   SUPABASE_ACCESS_TOKEN — personal access token from
        #     https://supabase.com/dashboard/account/tokens
        #   SUPABASE_PROJECT_REF  — production project Reference ID
        #     (Supabase Project Settings → General → Reference ID)
        #   SUPABASE_DB_PASSWORD  — production database password
        #     (Supabase Project Settings → Database → Database password)
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_PROJECT_REF: ${{ secrets.SUPABASE_PROJECT_REF }}
          SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
        run: |
          supabase db push \
            --project-ref "$SUPABASE_PROJECT_REF" \
            --password "$SUPABASE_DB_PASSWORD"
```

**Step 5 — Manual operator setup (not agent-executable; must precede first merge)**

The implementer must configure three GitHub secrets before or immediately after
merging this PR. Navigate to:
`GitHub repo → Settings → Secrets and variables → Actions → New repository secret`

| Secret name | Where to find the value |
|-------------|------------------------|
| `SUPABASE_ACCESS_TOKEN` | supabase.com → Account → Access Tokens → Generate new token |
| `SUPABASE_PROJECT_REF` | Supabase dashboard → Project Settings → General → Reference ID |
| `SUPABASE_DB_PASSWORD` | Supabase dashboard → Project Settings → Database → Database password |

All three refer to the **production** Supabase project.

---

### Test plan (AC-by-AC)

Because this is pure CI/infrastructure work there are no unit or Playwright
tests. Verification is a combination of structural review (reviewer reads the
YAML) and live CI observation.

| AC | How it is satisfied | Verification method |
|----|--------------------|--------------------|
| AC1 — migration applied on merge to main | `migrate` job uses `supabase db push --project-ref` with prod ref; job `needs: lint-build-test` and runs on `push` to `main` (a merged PR = push to main) | Merge a trivial PR and observe `migrate` job passes in GitHub Actions; confirm in Supabase dashboard → Database → Migrations that the migration row appears |
| AC2 — failing migration stops pipeline | `supabase db push` exits non-zero on SQL error; GitHub Actions marks job failed; any downstream jobs (none today) would be blocked | Test manually: introduce a deliberate SQL syntax error in a scratch migration, push to main, observe job fails; then revert |
| AC3 — idempotent re-runs | Supabase CLI records applied migrations in `supabase_migrations.schema_migrations`; subsequent pushes skip already-applied files; SQL guards (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`) provide an extra safety net | Merge twice to main without adding new migrations; observe second `migrate` run logs "No migrations to apply" (or equivalent) and exits 0 |
| AC4 — skipped on PR branches | `if: github.event_name == 'push'` evaluates to `false` for `pull_request` events | Open a PR and observe GitHub Actions shows only `lint-build-test`; `migrate` is listed as skipped |
| AC5 — secrets documented in step comment | The `Apply database migrations` step carries an inline YAML comment listing all three secrets and where to find each one | Reviewer inspects `.github/workflows/ci.yml` |

---

### Risks and rollback

**Risk 1 — Vercel timing (AC2 partial gap)**

Vercel auto-deploys are triggered by the GitHub push webhook and run in
parallel with GitHub Actions, not sequentially after it. If `db push` fails,
Vercel may still deploy the application code before the failure is visible in
Actions. In practice `db push` takes 10–30 seconds while a Vercel build takes
1–2 minutes, so the migration completes first. For a true gate, Vercel's
auto-deploy would need to be disabled and replaced with a `vercel deploy` CLI
step that runs only after the `migrate` job succeeds. This is out of scope but
should be tracked as a future improvement.

**Risk 2 — Secrets not configured**

If any of the three secrets is missing when the first merge to main happens,
the `migrate` job fails immediately. This does not affect the `lint-build-test`
job. The fix is to add the missing secrets and re-run the failed job.
Rollback: no code change needed; just configure the secrets.

**Risk 3 — First run re-applies manually-applied migration**

`20260628000001_create_users_table.sql` was applied via the Supabase SQL
Editor (STORY-03) and is absent from `supabase_migrations.schema_migrations`.
On the first CI run `db push` will re-apply it. The SQL is idempotent so this
is safe; it will not duplicate data or error. After the first run the tracking
table is updated and subsequent runs skip the file.

**Risk 4 — Loose CLI version pin**

`supabase/setup-cli@v1` with `version: latest` installs whatever is current at
run time. A major CLI version bump could introduce breaking flag changes.
Mitigation: pin to a specific semver (e.g. `version: 2.x`) once the initial
run is verified; update `.github/workflows/ci.yml` accordingly.

**Rollback procedure**

If the `migrate` job causes problems: remove the `migrate` job block from
`ci.yml` and revert `supabase/config.toml`. Migrations already applied to prod
are not rolled back by reverting the CI change — schema rollback would require
a manual SQL operation in the Supabase dashboard, which is out of scope for
this story.
