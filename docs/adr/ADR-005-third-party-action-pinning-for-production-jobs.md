# ADR-005: Pin Third-Party GitHub Actions and CLI Tools for Production-Write Jobs

**Status:** Accepted (CHORE-04, PR #8)  
**Date:** 2026-06-28  
**Author:** Simão, Agent  
**Related issue:** CHORE-04

## Context

GitHub Actions CI/CD pipelines often use third-party actions to perform critical tasks like database migrations, deployments, and infrastructure changes. Third-party actions can be specified with a version reference:
- Mutable major tag: `@v1` (always points to the latest v1.x.x release)
- Mutable major.minor tag: `@v1.7` (always points to the latest v1.7.x release)
- Immutable semver tag: `@v1.7.1` (points to exactly v1.7.1; immutable)
- Latest tag: `@latest` (most unstable; always latest)

For jobs that write to production (e.g., database migrations, deployments), uncontrolled version bumps can silently break deployments or corrupt data.

### Example Scenario

An action pinned to `@v1` might be:
1. `v1.7.1` today (tested, working)
2. Developer merges code to main
3. Action maintainer releases `v1.8.0` with a breaking flag change
4. Vercel webhook triggers CI immediately
5. CI runs with `v1.8.0`, old flags fail, migration job silently fails
6. Vercel build continues in parallel, deploys app code referencing a table that does not exist
7. Production is broken until developer notices hours later

## Decision

For all GitHub Actions jobs that:
- Write to a database or storage system
- Deploy code or infrastructure
- Make network calls to production services
- Are irreversible or have high consequences

**Always pin to an immutable release tag** (e.g. `@v1.7.1`), not a mutable tag or `@latest`.

Additionally, **pin bundled CLI tools and runtimes to specific semver versions** within the Action's configuration. For example:
```yaml
- uses: supabase/setup-cli@v1.7.1  # Immutable action tag
  with:
    version: 2.22.6                # Immutable CLI version
```

### Key Design Points

1. **Immutable action tags**: Always use `@v<major>.<minor>.<patch>` (e.g., `@v1.7.1`). Never use:
   - `@latest` (most unstable)
   - `@v1` (mutable; tracks latest v1.x.x)
   - `@v1.7` (mutable; tracks latest v1.7.x)

2. **CLI/tool version pinning**: If the action installs a CLI tool or version-dependent binary, pin it to a specific semver (e.g., `version: 2.22.6`, not `latest` or `2.x`). This ensures:
   - Reproducible CI runs across time
   - No surprises from breaking changes in minor versions
   - Intentional upgrades (developer changes the pin and tests)

3. **Explicit update policy in comments**: Include a comment explaining the pinning rationale, where to find new releases, and when to update. Example:
   ```yaml
   # Pin to immutable release tag — update intentionally; see https://github.com/supabase/setup-cli/releases
   - uses: supabase/setup-cli@v1.7.1
     with:
       # Pinned to avoid unexpected CLI breaking changes; update intentionally.
       version: 2.22.6
   ```

4. **Carve-outs for read-only jobs**: Jobs that only read artifacts, run tests, or build without deploying may use mutable tags if they have no side effects:
   - `actions/checkout@v4` is safe (just fetches code)
   - `actions/setup-node@v4` is safe (just installs a dev dependency)
   - These are foundational actions maintained by GitHub; mutable tags are acceptable

5. **Breaking changes procedure**:
   - When a third-party action releases a breaking change, update the pinned version deliberately.
   - Test the change locally or on a feature branch first.
   - Merge the upgrade in a separate PR with a clear commit message (`chore: upgrade supabase/setup-cli from v1.7.1 to v1.8.0`).
   - Never auto-pin or pin "latest" at build time.

## Consequences

### Positive

- **Predictable CI behavior**: A CI run at commit A always behaves the same way, regardless of when it runs (today vs. 6 months from now).
- **Reproducible builds**: Builds are reproducible across environments and time; critical for debugging production incidents.
- **Safer production deployments**: Eliminates the risk of surprise breaking changes in third-party tools during a production deployment.
- **Clear audit trail**: Changes to tool versions are explicit commits in git; easy to trace when and why a tool was upgraded.
- **Intentional upgrades**: New versions of tools are adopted deliberately, not accidentally. Developers review release notes before upgrading.

### Negative / Trade-offs

- **Manual upgrade maintenance**: Action maintainer releases a new version that fixes a critical bug, but the team must intentionally upgrade and test before it takes effect.
- **Slightly more verbose YAML**: Each pinned action requires explicit version numbers in config; more lines of YAML than `@latest`.
- **Requires discipline**: Team members must resist the temptation to use mutable tags for convenience; code review should catch violations.

## Alternatives Considered

1. **Pin only Action tags, not CLI versions**: Pros: simpler, avoids double-pinning. Cons: the Action might pull the latest CLI, which can have breaking changes independent of the Action version.

2. **Use dependabot to auto-pin and auto-update**: Pros: fully automated, always on latest patch. Cons: requires merging a PR per update, adds CI noise, doesn't address the root issue (latest is still mutable).

3. **No pinning; accept breakage as a cost of staying current**: Pros: zero maintenance. Cons: production incidents from unexpected breaking changes; unable to reproduce past builds.

4. **Immutable full container images**: Pin the exact container digest (e.g., `supabase/setup-cli@sha256:abc123...`). Pros: maximum safety. Cons: very difficult to maintain; unclear to developers what they're pinning; not feasible for most third-party actions (maintainers don't publish digest SHAs).

## Related

- CHORE-04: Automate database migrations in CI/CD (implementation example)
- CLAUDE.md CI environment section: Guidelines for Supabase CLI and third-party actions
- GitHub Actions documentation on action versioning

## Acceptance

This decision ensures that production-write jobs in CI/CD pipelines are reproducible, safe from breaking changes, and explicitly controlled by the team. Immutable pinning is standard DevOps hygiene for critical infrastructure. The pattern scales to all future CI jobs that affect production or are irreversible.
