# PRD — Team Scheduler for Church Service Roles

**Status:** Draft for review
**Author:** Simão Vale de Gato (coordinator, sound & multimedia — ADSintra)
**Last updated:** 2026-06-27
**Working name:** _Escala_ (TBD)

---

## 1. Problem & context

Every Sunday, the sound and multimedia ministries at ADSintra need a person
assigned to each role. Today the coordinator builds this schedule by hand,
which is time-consuming, easy to get wrong, and hard to keep fair. It is tricky
to remember who served recently, who is still learning, who is away, and to
make sure an inexperienced person is never left alone on a role they can't yet
handle.

The coordinator wants a tool that, given the team and their skill levels,
**automatically generates a balanced schedule for the next several weeks**
(default: 1 month), lets him **tweak it manually**, and produces a
**shareable image with a ready-to-send Portuguese (pt-PT) message** for the
WhatsApp group.

## 2. Target users / personas

- **Coordinator (primary user).** Leads sound & multimedia. Manages the team,
  sets skill levels, generates and adjusts schedules, and sends them out. Not a
  developer; works from phone and laptop.
- **Team member / volunteer (secondary user).** Serves on one or more roles.
  Logs in mainly to **block dates they're unavailable** and to see when they're
  scheduled. Low technical skill; minimal friction required.
- **Future: co-leaders / other ministry leaders.** May later need to schedule
  other teams (e.g. the worship band). The role model must be generic enough to
  support this without a rebuild.

## 3. Goals and non-goals

### Goals
- Generate a balanced, rule-respecting schedule for a configurable horizon
  (default 1 month) in seconds.
- Model **configurable roles** (not hardcoded to sound/multimedia) and
  **per-role skill levels (1–3)** per person.
- Let volunteers mark **specific dates** they cannot serve.
- Let the coordinator **manually edit** any generated assignment.
- Export the schedule as an **image** plus a **default pt-PT message** to paste
  into the group chat.

### Non-goals (for now)
- Individual per-person reminders, calendar (.ics) export, or push
  notifications. _(Possible later.)_
- Automatic sending to WhatsApp/email (coordinator copies the image + message
  manually).
- Scheduling logic for non-Sunday events, rehearsals, or complex multi-service
  days.
- Worship-band scheduling as a built feature — but the data model should not
  block it later.
- Payroll, attendance tracking, or song/setlist management.

## 4. Success metrics

- **Time to produce a month's schedule** drops from ~current manual effort to
  **under 5 minutes** including review and tweaks.
- **≥ 90% of generated assignments accepted** without manual change (proxy for
  "the auto-schedule is genuinely good").
- **Zero hard-rule violations** in generated schedules (no one scheduled on a
  blocked date; no lone beginner on a role).
- Coordinator uses it for **every month** after launch (sustained adoption).
- Volunteers can block a date in **under 1 minute** from their phone.

## 5. Key user journeys

1. **Set up the team (coordinator).** Create roles (e.g. Sound, Multimedia),
   add people, set each person's skill level (1–3) per role, mark who can serve
   which roles.
2. **Volunteer blocks dates.** Volunteer logs in with Google, sees upcoming
   Sundays, taps the dates they're away. Default is "available unless blocked."
3. **Generate a schedule.** Coordinator picks a date range (default: next 4
   Sundays / 1 month), clicks Generate. The app produces a balanced draft
   respecting all rules.
4. **Review & adjust.** Coordinator sees the draft as a table, swaps or
   reassigns any slot (with warnings if an edit breaks a rule), and confirms.
5. **Share.** Coordinator exports an image + a pre-written pt-PT message and
   pastes both into the WhatsApp group.

## 6. Functional requirements

**Team & roles**
1. The coordinator can create, rename, and remove **roles**. Roles are
   configurable, not hardcoded.
2. Each role has a **default number of slots per Sunday** (e.g. Sound = 1),
   and a slot can be added ad hoc (e.g. a 2nd "training" seat on Sound).
3. The coordinator can add/edit/remove **people**.
4. Each person has, per role they can serve, a **skill level: 1 (Beginner),
   2 (Intermediate), 3 (Expert)**. A person not assigned a level for a role
   cannot be scheduled for it.

**Availability**
5. Volunteers (and the coordinator on their behalf) can **block specific
   Sundays**. Default state is available.
6. Blocked dates are a **hard constraint** — the generator must never assign a
   blocked person on that date.

**Schedule generation**
7. The coordinator can generate a schedule for a **chosen date range**, default
   **the next 1 month of Sundays**.
8. The generator must enforce these **hard rules**:
   - a. Never assign someone on a date they blocked.
   - b. Never leave a role-slot filled by a **lone Beginner (level 1)** — a
     beginner must be paired with someone level 2+ on that role/date, or the
     beginner is not scheduled alone.
   - c. Only assign people qualified (has a skill level) for that role.
9. The generator should optimize these **soft preferences** (best-effort,
   surfaced as warnings when violated):
   - a. **Avoid back-to-back weeks** for the same person.
   - b. **Workload weighted by expertise over a rolling horizon (~3 months):**
     more skilled/experienced people serve more often; newer/lower-skill people
     serve less but steadily — trending so that over time everyone is used in
     proportion to their skill. _(Exact weighting in §8 open questions.)_
10. The generator must consider **history** (recent assignments) so fairness and
    back-to-back rules work across generations, not just within one batch.

**Review & edit**
11. The generated schedule is shown as an **editable table** (Sundays × roles).
12. The coordinator can **reassign, swap, or clear** any slot manually.
13. A manual edit that breaks a hard rule is **flagged with a clear warning**;
    the coordinator may override soft-rule warnings.
14. The coordinator can **regenerate** while keeping manually locked slots.

**Output & sharing**
15. The coordinator can **export the confirmed schedule as an image**
    (clean, legible table).
16. The app provides a **default editable message in pt-PT** to accompany the
    image (e.g. greeting + "escala das próximas semanas").
17. On mobile, sharing uses the **browser's native Share sheet** (Web Share API)
    so the user can pick WhatsApp directly. On desktop, image + message are
    **copied to clipboard** as a fallback.

**Accounts**
18. Authentication is via **Google login** for all users.
19. There are two **user roles:**
    - **Admin** — full access: manage people, roles, skill levels, generate and
      edit schedules, manage other users' availability. Can promote other users
      to Admin. Multiple admins allowed.
    - **Member** — limited access: block/unblock their own dates, view the
      published schedule for their team. Cannot edit others' data.
20. New users who log in for the first time are **Members by default**; an Admin
    must promote them.

## 7. Non-functional requirements

- **Platform:** Responsive **web app**, usable on phone and computer.
- **Language / i18n:** UI and generated message in **Portuguese (pt-PT)** as
  primary; build with i18n so other languages are possible. Dates/weekdays in
  Portuguese.
- **Performance:** Generate a 1-month schedule in **< 3 seconds**.
- **Usability:** A volunteer can block a date in **< 1 minute**, no manual.
- **Reliability:** Schedule data persists; regenerating never loses confirmed/
  locked assignments.
- **Security/privacy:** Personal data limited to name, email, skills,
  availability. Google OAuth; volunteers see only their own availability edit
  controls. Small known group — no public sign-up by default.
- **Accessibility:** Legible exported image (contrast, font size); basic
  WCAG-friendly UI.
- **Scale:** Small (single team ≈ up to ~10–25 people now); design shouldn't
  preclude multiple teams later.

## 8. Constraints, assumptions, open questions

**Constraints**
- Personal project, **no hard deadline** — build an MVP, then iterate.
- **Free hosting only** — small user base (team of ~5–15 people); free tiers
  (e.g. Vercel + Supabase free tier) are the target deployment.
- Low-friction login is essential for volunteers.

**Assumptions**
- Services are **weekly on Sundays**, one service per day.
- Typically **1 person per role per Sunday**; Sound occasionally has a 2nd
  "training" seat — always opt-in by the Admin per week, never automatic.
- Members will log in to block dates; Admin can override on their behalf.
- pt-PT is the only language needed at launch.
- No history seeding — fairness tracking starts from zero on first use.

**Decisions made**
1. **Fairness weighting rule:** use a weighted-service-count model over a
   **rolling 3-month window**. Target weights by skill level:
   **Expert (3) : Intermediate (2) : Beginner (1) ≈ 3 : 2 : 1** (i.e. an
   Expert is targeted for ~3× the Sundays of a Beginner). Generator picks the
   person most "under-served" relative to their target weight each time.
2. **Beginner training seat:** the Admin explicitly adds a 2nd training slot to
   a specific Sunday; only then can a Beginner be scheduled alongside the
   primary person.
3. **Infeasible schedules:** generate a partial schedule, leave unfillable slots
   empty, and surface clear warnings. Admin decides how to resolve.
4. **History seeding:** no seeding — start fresh. Fairness converges
   naturally over the first 1–2 months.
5. **Hosting:** free tier; Vercel (frontend) + Supabase (database/auth) is the
   target stack unless a simpler option fits better.

**Remaining open questions**
- **Multiple teams / band:** confirmed out of scope for MVP, but the role
  model stays generic so it can be extended later.

## 9. Rough scope / phasing

**MVP (Phase 1)**
- Google login; **Admin** and **Member** roles.
- Configurable roles + slots; people with per-role skill levels (1–3).
- Members block specific Sundays; Admin can block on anyone's behalf.
- Generate balanced schedule for a date range (default 1 month) with hard rules
  (blocked dates, no lone beginner, qualified-only) and soft rules
  (avoid back-to-back, 3:2:1 expertise-weighted workload from history).
- Editable schedule table with rule warnings; Admin can lock individual slots.
- Export as image + default pt-PT message; **native Share sheet** on mobile
  (Web Share API), copy-to-clipboard fallback on desktop.

**Phase 2 (nice-to-have)**
- Smarter fairness tuning and a 3-month rolling dashboard of who served how
  often.
- Recurring availability patterns (e.g. "only twice a month").
- Co-leader role and multiple teams (band).
- Per-person reminders, calendar (.ics) export, direct WhatsApp share.

---

### Please confirm before we move to `/epics`

Key open questions I need your call on:
1. **Fairness weighting** — concrete rule (e.g. Expert ≈ 2× a Beginner) and
   window (3 months)?
2. **Beginner "training seat"** — auto-added or opt-in per week?
3. **Infeasible schedules** — partial + warnings acceptable?
4. **First-schedule history** — start fresh or enter recent history manually?
5. **Hosting/budget** — any preference or constraint?

Once you confirm these (or say "use your best judgment"), I'll proceed to break
this into epics.
