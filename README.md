# Escala

A scheduling tool for managing church ministry volunteers. Built for the sound and multimedia team at ADSintra, though the role model is generic enough to serve any small team that rotates people across configurable roles.

## What it does

The coordinator picks a date range, the app generates a balanced schedule — respecting blocked dates, skill-level constraints, and fairness across the team — and then exports it as an image with a ready-to-send Portuguese message for the WhatsApp group.

Team members log in with Google to block dates they can't serve. The coordinator reviews and adjusts the draft before publishing.

## Stack

- **Next.js 16** (App Router) with **React 19** and TypeScript
- **Supabase** for Postgres, Auth, and Row-Level Security
- **Tailwind CSS v4** and **shadcn/ui** for components
- **next-intl** for Portuguese (pt-PT) localisation
- **Playwright** for end-to-end tests
- Deployed on **Vercel** (frontend) + **Supabase free tier** (database)

## Local development

**Prerequisites:** Node 24+, npm, a Supabase project.

```bash
git clone <repo>
cd scheduler
npm install
```

Copy the environment template and fill in your Supabase credentials:

```bash
cp .env.example .env.local
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (server-only, never exposed to the browser) |

See `docs/stories/CHORE-03-separate-dev-prod-supabase.md` for setting up separate dev and production Supabase projects.

## Database migrations

Migrations live in `supabase/migrations/`. Apply them to your linked project:

```bash
npx supabase db push --project-ref <your-project-ref>
```

## Running tests

```bash
# End-to-end tests (Playwright)
npm run test:e2e

# Lint
npm run lint

# Type check
npx tsc --noEmit
```

## User roles

| Role | Can do |
|---|---|
| **Admin** | Manage people, roles, and skill levels; generate and edit schedules; manage other users' availability; promote/demote Admins |
| **Member** | Block their own availability; view the published schedule |

New users who sign in with Google are Members by default. An Admin must promote them.

## Project docs

- `docs/product/PRD.md` — Product requirements
- `docs/epics/` — Feature epics
- `docs/stories/` — Implementation stories
- `docs/adr/` — Architecture decision records
