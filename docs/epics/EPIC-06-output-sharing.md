# EPIC-06 — Output & Sharing

## Goal
Turn a confirmed schedule into something the Admin can send to the team in
seconds: a clean **image** of the schedule table plus a **default editable
pt-PT message**, shared via the **native Share sheet on mobile** (pick WhatsApp
directly) with a **copy-to-clipboard fallback on desktop**.

## Why it matters
This closes the loop. The Admin's actual job is "tell the team who serves when";
a good-looking image + ready message dropped straight into WhatsApp is the
payoff that makes the whole tool worth using.

## Scope (in)
- Render the confirmed schedule as a **clean, legible image** (good contrast,
  readable on a phone).
- Provide a **default editable pt-PT message** (greeting + "escala das próximas
  semanas" style) to accompany the image.
- **Mobile:** share image + message via the **Web Share API** (native sheet).
- **Desktop:** **copy image + message to clipboard** as fallback.
- pt-PT dates/weekdays in the image.

## Out of scope
- Direct/automatic sending to WhatsApp or email.
- Per-person individual messages, calendar (.ics) export (Phase 2).
- Editing schedule content here (EPIC-05).

## Dependencies
- EPIC-05 (a confirmed schedule to export), EPIC-01 (pt-PT i18n).

## Acceptance signals
- The Admin can generate a legible schedule image from a confirmed schedule.
- A default pt-PT message is offered and editable before sharing.
- On a phone, the native Share sheet opens with image + text and WhatsApp is a
  selectable target.
- On desktop, image + message are copied to the clipboard.
- Dates/weekdays render in Portuguese.

## Candidate stories
- Render confirmed schedule as a shareable image
- Default editable pt-PT accompanying message
- Mobile share via Web Share API
- Desktop copy-to-clipboard fallback
- pt-PT date/weekday formatting in output
