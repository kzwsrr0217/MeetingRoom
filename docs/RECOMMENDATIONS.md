# MeetingRoom — Project Review & Recommendations

> **Update 2026-07-14 — implemented this iteration** (all verified on Podman, mock mode,
> 97 backend unit + 27 e2e + 30 frontend tests green):
> - ✅ **Real check-in** + **no-show auto-release** (grace `CHECKIN_GRACE_MIN`, `AUTO_RELEASE`)
> - ✅ **Release now** (end meeting early) and **Extend +15 min** — kiosk buttons + API
> - ✅ Graph events tagged `MeetingRoomKiosk` so only kiosk-created events are ever mutated
> - ✅ **React error boundary** (auto-reloads an unattended panel)
> - ✅ **Burn-in protection** (1px pixel-shift + night dim outside office hours)
> - ✅ **Rate limiting** on panel actions + **Graph 429/503 retry-with-backoff**
> - ✅ MSAL client-credentials auto-activates on `AZURE_*`; compose provider + corp-CA build
> - ✅ **id-based room URLs** (kiosk/admin use slug ids; display name resolved; mock matches id or name)
> - ✅ **QR "book from phone"** on the kiosk (offline, no external calls)
>
> **Deferred (need external systems / larger effort or a product decision):**
> admin Azure SSO (needs the app registration), TLS/Key Vault (infra), CI pipeline,
> analytics/audit DB, i18n, occupancy sensors. Rationale inline below.

---

Written 2026-07-14 after a full code review and a working Podman run (mock mode).
Priorities: **[PILOT]** = do before letting real users test · **[PRE-PROD]** =
before production · **[LATER]** = valuable, not blocking.

The existing [IMPROVEMENTS.md](IMPROVEMENTS.md) and [PHASE2_PLAN.md](PHASE2_PLAN.md)
already cover the Azure/MSAL/deployment path (much of which is now implemented).
This document focuses on **product, UX, and test-readiness** gaps not covered there.

---

## 1. What's needed to actually test it (kiosk + admin)

### [PILOT] Make "Check-in" real — biggest functional gap
Today check-in is **cosmetic**: the kiosk shows a success toast
([RoomDisplay.tsx:226](../frontend/src/components/RoomDisplay.tsx)) and the backend
`POST /checkin` is a no-op ([calendar.controller.ts](../backend/src/calendar/calendar.controller.ts)).
The single highest-value feature of a room panel is **no-show auto-release**:
if nobody checks in within N minutes of the start, free the slot. Without it, the
panel only *displays* — it doesn't improve utilisation. Minimum for a pilot:
persist check-ins and reflect them; auto-release can follow.

### [PILOT] Single source of truth for the room list
The frontend still ships a hard-coded `ROOMS` array
([config.ts](../frontend/src/config.ts)) used as a fallback, while the backend owns
the real list. They can drift (rename a room in admin → the static fallback is
stale until the API responds). Keep the backend authoritative and reduce the
static list to a tiny loading placeholder (or none).

### [PILOT] Address rooms by `id`, not display name
The kiosk puts the room **name** in the URL (`?room=MMH%20Balaton`) and sends it
as the path param. The backend now resolves either id or name
(`findByIdOrName`), so it works — but names with spaces/accents in URLs are
fragile and rename-unsafe. Switch kiosk links to the slug `id` (`?room=mmh-balaton`).

### [PILOT] Admin test checklist
- Set `ADMIN_API_KEY`, enter it in **Admin → System → Admin kulcs**, confirm
  add/edit/delete room works and that a wrong/absent key is rejected. *(verified
  working in this review)*
- Add each real room's Outlook `calendarEmail` — required for live Graph mode.
- Confirm preset organiser names propagate to kiosks.

### [PILOT] Graph "dry-run" before the demo
Once the Azure app exists: `GET /api/health` should show `"auth":"msal"`, then
verify a booking made on the kiosk appears in Outlook and that a meeting booked
in Outlook shows on the kiosk within the poll interval.

---

## 2. Rough edges still worth fixing

| Pri | Item |
|-----|------|
| [PILOT] | **No React error boundary** — a render error blanks the whole kiosk. Add a top-level boundary that shows a friendly "restarting" screen and auto-reloads. |
| [PILOT] | **Error screen is all-or-nothing** — when the backend blips, the kiosk replaces the whole UI with the error screen ([App.tsx](../frontend/src/App.tsx)). Prefer keeping the last-known status visible with a small "stale / reconnecting" banner. |
| [PRE-PROD] | **Booking has no server-side rate limit** — add throttling (e.g. `@nestjs/throttler`) so a stuck kiosk can't spam Graph. |
| [PRE-PROD] | **Graph 429 throttling not handled** — Microsoft Graph throttles aggressively; add retry-with-backoff and honour `Retry-After`. The new status cache helps but isn't enough. |
| [PRE-PROD] | **Clock drift** — the kiosk trusts the tablet clock for "now". A wrong tablet clock shows wrong availability. Consider deriving "now" from a server timestamp. |
| [LATER] | **`config.ts` `STORAGE_KEY_PRESET_NAMES`** is unused (names are server-side now) — dead code. |

---

## 3. Pre-production must-haves

- **[PRE-PROD] Admin SSO** — replace the shared `ADMIN_API_KEY` with Azure AD
  login + a security group (PHASE2 Step 5). The key guard is a good stop-gap, not
  a production control.
- **[PRE-PROD] TLS everywhere** — terminate HTTPS at the ingress; tablets should
  talk to the panel over https (Wake Lock and PWA install require a secure context).
- **[PRE-PROD] Secrets in a vault** — Azure Key Vault / Managed Identity instead
  of `.env` (Managed Identity removes the client secret entirely).
- **[PRE-PROD] Observability** — ship logs somewhere, alert on `auth` flipping to
  `unconfigured`/token-expired, and on panels going offline. `/api/health` is
  ready for k8s liveness/readiness probes.
- **[PRE-PROD] CI pipeline** — run `npm test` + `npm run test:e2e` + build images
  on every push (108 backend tests already pass). Add a Graph integration test
  against a test tenant.
- **[PRE-PROD] Backups** — `backend/data/{rooms,config}.json` are the only
  persistent state; mount a PVC/Azure Files and back it up.
- **[PRE-PROD] Booking write-back verification** — after creating an event,
  re-read to confirm it landed (Graph eventual consistency).

---

## 4. UI / UX polish

The kiosk is already strong (distance-readable status, ambient glow, idle dim,
2-tap booking, live "other rooms" view). Additions:

- **[PILOT] Burn-in protection** — these panels run 24/7. Add periodic 1px pixel
  shift and a scheduled deep-dim / off outside office hours (protects OLED/LCD and
  saves power). The idle overlay is a start but is static.
- **[PILOT] Confirm end-time before booking** — show the resulting end time
  *inside* the modal (currently only in the post-booking toast).
- **[LATER] i18n** — everything is hardcoded Hungarian. Extract strings and add
  English; useful for international visitors and for Global IT reviews.
- **[LATER] Accessibility** — verify contrast ratios on the dark theme, respect
  `prefers-reduced-motion` for the many animations, and ensure touch targets meet
  ~48px (mostly fine already).
- **[LATER] "Available for N min" framing** — when free, prominently show how long
  until the next meeting ("Free for 42 min") — the single most useful glance.
- **[LATER] QR code to book from phone** — let a passer-by scan and book without
  touching a shared surface (hygiene + convenience).

---

## 5. Feature parity with commercial panels (Robin, Joan, Evoko, MS Places)

Prioritised by value/effort for this system:

| Pri | Feature | Notes |
|-----|---------|-------|
| [PILOT] | **No-show auto-release** | Free the room if no check-in within N min. The #1 differentiator; needs the real check-in above. |
| [PILOT] | **End meeting early / release now** | One button to free the room when a meeting ends early — instantly improves availability. Graph: shorten/delete the event. |
| [PRE-PROD] | **Extend current meeting** | +15/+30 min if the next slot is free. Already listed in IMPROVEMENTS as nice-to-have; users expect it. |
| [PRE-PROD] | **Find another free room** | When busy, the "other rooms" modal already shows live status — add "book the nearest free one" in one tap. |
| [LATER] | **Utilisation analytics** | Bookings vs. actual check-ins per room/day → the report facilities teams actually want. Needs an audit log (a small DB). |
| [LATER] | **Occupancy sensor input** | Presence sensors auto-release ghost meetings without relying on manual check-in. Future hardware. |
| [LATER] | **"Report an issue" button** | Broken AV/heating → creates a ticket/email to facilities. Cheap, very appreciated. |
| [LATER] | **Meeting privacy toggle** | Show "Private meeting" instead of the subject/organiser for sensitive bookings (GDPR-friendly). Graph exposes sensitivity. |
| [LATER] | **Status LED / colour bar** | A green/red edge visible down a corridor (some panels drive a hardware LED; here the on-screen border already approximates it). |

---

## 6. Engineering best practices

- **[PRE-PROD] Config validation at startup** — fail fast (or log loudly) if
  `USE_MOCK_DATA=false` but neither Azure creds nor a token are set. Half-done via
  the `health.auth` field; make it a startup check too.
- **[LATER] Adopt DTO validation** — the manual validators added in this review
  are fine; longer term, `class-validator` + a global `ValidationPipe` centralises
  it. (Deferred deliberately to avoid a new dependency in the POC.)
- **[LATER] API versioning** — prefix `/api/v1` before external clients depend on it.
- **[LATER] Audit log / small DB** — the app is stateless-by-design (events live
  in Outlook), but analytics, no-show tracking, and "who released the room" all
  want a lightweight store (SQLite/Postgres).
- **[LATER] Move the `data/` JSON store to a real store** for multi-replica
  deployments — two backend replicas writing `rooms.json` will race. Fine for a
  single replica; revisit before scaling out.

---

## 7. Suggested order

1. **Pilot-ready:** real check-in, room-list single source of truth, id-based
   URLs, error boundary, burn-in protection.
2. **Go-live with Azure:** app registration → set `AZURE_*` → verify `auth:msal`
   → map room mailboxes → admin SSO → TLS + secrets vault.
3. **Differentiators:** no-show auto-release, end-early / extend, find-free-room.
4. **Scale & insight:** analytics + audit DB, i18n, sensors, CI/observability.
