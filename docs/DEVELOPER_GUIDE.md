# MeetingRoom — Developer Guide

## Overview

MeetingRoom is a tablet/kiosk application that displays real-time meeting room availability and allows instant bookings via Microsoft Outlook. It consists of:

- **Backend** — NestJS (TypeScript) REST API, port 3000
- **Frontend** — React 19 + Vite + Tailwind CSS 4, port 5173
- **Calendar source** — Microsoft Graph API (or mock data for development)

Room configuration persists in `backend/data/rooms.json`. Meeting data comes from Outlook via the Graph API (or mock simulation).

---

## Prerequisites

| Tool | Minimum version | Notes |
|------|----------------|-------|
| Docker Desktop | 4.x | Enable WSL 2 backend on Windows |
| Node.js | 20.x LTS | Only needed for local (non-Docker) dev or running tests directly |
| npm | 10.x | Comes with Node 20 |

---

## Quick Start (Docker Desktop)

```bash
cd c:\Projects\MeetingRoom
docker compose up
# First run takes 2-3 minutes (npm install inside containers)
```

**Access the app:**
- Kiosk UI: http://localhost:5173
- Admin dashboard: http://localhost:5173/admin
- Backend API: http://localhost:3000/api
- Health check: http://localhost:3000/api/health

**Stop:**
```bash
docker compose down
```

**Rebuild after package.json changes:**
```bash
docker compose down
docker compose up
```

> **Windows HMR note:** Vite's hot module replacement does not always fire on file changes when running inside Docker Desktop on Windows (inotify limitation). After editing frontend files, run `docker restart meetingroom_frontend` to pick up changes.

---

## GitHub Codespaces (Demo / Sharing with Colleagues)

Codespaces runs the full dev environment in the cloud — no local install needed.

1. Go to the GitHub repo → green **Code** button → **Codespaces** → **Create codespace on master**
2. Wait ~2 minutes for the container to build and `npm install` to complete
3. Open two terminals inside the Codespace:
   - Terminal 1: `cd backend && npm run start:dev`
   - Terminal 2: `cd frontend && npm run dev`
4. Codespaces auto-forwards port 5173 and opens a preview

**To share with colleagues:**
- In VS Code's **Ports** panel, right-click port **5173** → **Port Visibility** → **Public**
- Share that URL — colleagues open it in a browser with no login required

**GRAPH_TEMP_TOKEN in Codespaces:**
- Option A (quick): create `backend/.env` in the terminal with your token after the Codespace starts
- Option B (persistent): add `GRAPH_TEMP_TOKEN` as a [Codespaces Secret](https://github.com/settings/codespaces) in your GitHub account settings — it will be injected as an environment variable automatically on every Codespace

The Vite dev server proxies `/api` requests to `localhost:3000`, so only port 5173 needs to be shared publicly.

---

## Configuration

### Backend — `backend/.env`

```env
USE_MOCK_DATA=true    # "true" = simulated data, no Azure needed
PORT=3000
GRAPH_TEMP_TOKEN=     # Paste a fresh 1-hour Graph token here for live mode
```

**Note:** `USE_MOCK_DATA` in `docker-compose.yml`'s `environment:` block takes precedence over `.env`. The default is `true` (mock mode). Change it in `docker-compose.yml` for live mode.

After changing `.env`:
```bash
docker compose restart backend
```

### Rooms — Admin UI or `backend/data/rooms.json`

Rooms are managed at runtime via the admin dashboard (`/admin`) — no code changes required. The backend persists the room list to `backend/data/rooms.json` on disk.

Alternatively, edit `rooms.json` directly and restart the backend. The file is git-ignored; `backend/data/.gitkeep` just ensures the `data/` directory is tracked.

### Frontend — `frontend/src/config.ts`

Contains the static room fallback (shown before the API responds), default preset organiser names, localStorage keys, and the API base URL.

```typescript
export const ROOMS = ['MMH Séd', 'MMH Balaton', ...]; // static fallback only
export const DEFAULT_PRESET_ORGANIZERS = ['Kovács Péter', ...]; // default if backend empty
// Uses relative /api in dev/Codespaces (Vite proxies to localhost:3000).
// Set VITE_API_URL for production builds pointing to a remote backend.
export const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';
```

The live room list comes from `GET /api/rooms` — `ROOMS` in `config.ts` is only the initial fallback before the API responds.

---

## Application Routes

| URL | Description |
|-----|-------------|
| `http://localhost:5173/` | Kiosk view — first-run shows SetupScreen |
| `http://localhost:5173/?room=MMH%20Balaton` | Kiosk view forced to a specific room |
| `http://localhost:5173/admin` | Admin dashboard (desktop-optimised, no auth for POC) |

**First-run flow:** On first visit, `localStorage` has no home room set — the app renders the **SetupScreen** (full-screen room picker populated from the API). After selecting a room, it is saved to `localStorage` under the key `meetingroom_home` and the kiosk loads.

**Reset a tablet:** Hold the clock on the kiosk for 3 seconds. The home room is cleared from `localStorage` and the SetupScreen appears again.

---

## Development Modes

### Mock Mode (no Azure required)

Set `USE_MOCK_DATA=true` in `docker-compose.yml` (the default).

Mock behavior per room:

| Room | Status | Simulated daily schedule |
|------|--------|--------------------------|
| Balaton | Always occupied | 4 meetings throughout the day |
| Mars | Occupied after 14:00 | 1 meeting at 15:00–17:00 |
| Séd | Occupied during even hours | Meetings every 2 hours |
| Others | Always free | No schedule |

Bookings made on the kiosk flip the room to occupied until the booking expires (in-memory only, resets on backend restart). The booking title and organiser name are stored and shown on the status card.

### Live Mode (Microsoft Graph)

Requires a valid access token. See [Updating the Graph API Token](#updating-the-graph-api-token) below.

---

## Updating the Graph API Token

**Easiest way — admin UI (no restart required):**

1. Go to http://localhost:5173/admin
2. Paste a fresh token in the **Microsoft Graph Token** section
3. Click **Token alkalmazása** — the backend updates immediately, no restart needed

**Manual fallback — edit `.env`:**

1. Go to [Microsoft Graph Explorer](https://developer.microsoft.com/en-us/graph/graph-explorer)
2. Sign in with the Outlook account that owns the meeting room calendars
3. Click your avatar → **Access token** → copy the token
4. Open `backend/.env` and paste:
   ```env
   GRAPH_TEMP_TOKEN=eyJ0eXAiOiJKV1Qi...
   USE_MOCK_DATA=false
   ```
5. Restart the backend:
   ```bash
   docker compose restart backend
   ```

> **Note:** Tokens expire in ~60–75 minutes. The MSAL library (`@azure/msal-node`) is installed for future automatic token refresh but is not yet wired up.

---

## Project Structure

```
MeetingRoom/
├── .devcontainer/
│   └── devcontainer.json               # GitHub Codespaces configuration
├── backend/
│   ├── Dockerfile                      # Production multi-stage build
│   ├── data/
│   │   ├── .gitkeep                    # Ensures data/ is tracked by git
│   │   ├── rooms.json                  # Runtime room list (git-ignored)
│   │   └── config.json                 # Shared preset names (git-ignored)
│   └── src/
│       ├── main.ts                     # Entry point, CORS, port
│       ├── app.module.ts               # Root module, loads .env
│       ├── calendar/
│       │   ├── calendar.module.ts      # Selects Mock vs. Graph service at startup
│       │   ├── calendar.controller.ts  # /api/calendar/* routes
│       │   ├── calendar.service.ts     # Abstract base (updateToken no-op)
│       │   ├── mock-calendar.service.ts    # In-memory simulation + daily schedule
│       │   ├── mock-calendar.service.spec.ts
│       │   ├── calendar.controller.spec.ts
│       │   ├── graph-calendar.service.ts   # Real Microsoft Graph calls
│       │   └── domain/
│       │       └── room-status.model.ts    # RoomStatus interface
│       ├── rooms/
│       │   ├── room.model.ts               # Room interface
│       │   ├── rooms.service.ts            # CRUD + rooms.json persistence
│       │   ├── rooms.controller.ts         # /api/rooms/* routes
│       │   ├── rooms.module.ts
│       │   ├── rooms.service.spec.ts
│       │   └── rooms.controller.spec.ts
│       └── app-config/
│           ├── app-config.controller.ts    # /api/config/* (token + preset names)
│           ├── app-config.module.ts
│           └── app-config.controller.spec.ts
│   └── test/
│       └── app.e2e-spec.ts             # E2E integration tests (20 tests)
├── frontend/
│   ├── Dockerfile                      # Production multi-stage build (Vite + nginx)
│   ├── nginx.conf                      # nginx template — proxies /api to backend
│   └── src/
│       ├── main.tsx                    # React entry, strict mode
│       ├── test-setup.ts               # Vitest + jest-dom setup
│       ├── config.ts                   # Static fallback, API URL, storage keys
│       ├── App.tsx                     # Routing: /admin | SetupScreen | KioskApp
│       ├── hooks/
│       │   ├── useRooms.ts             # API fetch with static fallback, polls every 5 min
│       │   ├── useRooms.test.ts
│       │   ├── useRoomStatus.ts        # API polling, bookRoom returns string|null
│       │   ├── usePresetNames.ts       # Fetches preset names, caches to localStorage
│       │   ├── useCurrentTime.ts       # Live clock (re-renders every second)
│       │   ├── useIdleTimer.ts         # Fires isIdle after configurable inactivity timeout
│       │   └── useWakeLock.ts          # Screen Wake Lock API
│       └── components/
│           ├── RoomDisplay.tsx         # Main kiosk layout + UpcomingStrip + OtherRoomCard
│           ├── Header.tsx              # Clock + long-press reset
│           ├── StatusCard.tsx          # Free / Occupied + booking button
│           ├── MeetingDetails.tsx      # Current meeting info + countdown
│           ├── Timeline.tsx            # Day schedule bar + advance booking slots
│           ├── BookingModal.tsx        # Title + duration + name picker modal
│           ├── SetupScreen.tsx         # First-run room picker
│           ├── AdminView.tsx           # Admin dashboard (/admin)
│           ├── SetupScreen.test.tsx
│           └── BookingModal.test.tsx
├── docker-compose.yml
├── .gitignore
└── docs/
```

---

## API Reference

Base URL: `http://localhost:3000/api`

### GET `/health`

Returns backend status, mode, and how it authenticates to Graph.

**Response:**
```json
{ "status": "ok", "mode": "mock", "auth": "none", "timestamp": "2026-06-16T04:51:40.000Z" }
```

`mode` is `"mock"` or `"graph"`. `auth` is `"none"` (mock), `"msal"` (Azure app),
`"temp-token"` (manual token), or `"unconfigured"` (graph mode with no credentials).

> **Admin/mutating endpoints** (`POST/PATCH/DELETE /rooms*`, `PUT /config/*`) are
> protected by the `AdminKeyGuard`. When `ADMIN_API_KEY` is set, send it as an
> `x-admin-key` header; when unset the guard is fail-open (POC/local).
>
> **Panel action endpoints** (`book`, `checkin`, `release`, `extend`) are rate
> limited (default 30 req / 10 s per IP → HTTP 429 when exceeded).

---

### GET `/rooms`

Returns all configured rooms sorted by display order.

**Response:**
```json
[
  { "id": "mmh-sed", "name": "MMH Séd", "calendarEmail": "", "order": 0 },
  { "id": "mmh-balaton", "name": "MMH Balaton", "calendarEmail": "", "order": 1 }
]
```

### POST `/rooms`

Creates a new room.

**Body:** `{ "name": "MMH Jupiter", "calendarEmail": "jupiter@company.hu" }` (`calendarEmail` optional)

**Response:** The created `Room` object (HTTP 201).

### PATCH `/rooms/:id`

Updates a room's name, email, or order. All fields optional.

**Body:** `{ "name": "New Name", "calendarEmail": "new@company.hu", "order": 2 }`

**Response:** The updated `Room` object.

### DELETE `/rooms/:id`

Removes a room. Remaining rooms are re-numbered to keep order contiguous.

**Response:** `{ "success": true }`

### POST `/rooms/reset`

Restores the 6 default rooms (MMH Séd, Balaton, Mars, Tihany, Bakony, Kis Balaton).

**Response:** Array of default rooms.

---

### GET `/config/graph-token/status`

Returns the current token status.

**Response:**
```json
{ "hasToken": true, "expiresAt": "2026-06-16T05:51:00.000Z" }
```

### PUT `/config/graph-token`

Hot-swaps the Graph token at runtime (no backend restart required). Also updates `backend/.env`.

**Body:** `{ "token": "eyJ0eXAi..." }`

**Response:** `{ "success": true, "expiresAt": "..." }`

---

### GET `/config/preset-names`

Returns the shared preset organiser names.

**Response:** `["Kovács Péter", "Nagy Anna", ...]`

### PUT `/config/preset-names`

Saves the preset names (shared across all kiosks).

**Body:** `{ "names": ["Alice", "Bob"] }`

**Response:** The saved `string[]`.

---

### GET `/calendar/room/:roomId/status`

Returns the current status of a room.

**URL parameter:** `roomId` — accepts either the slug **id** (`mmh-sed`, preferred)
or the display **name** (`MMH%20S%C3%A9d`); both resolve to the same room.

**Response:**
```json
{
  "roomId": "mmh-sed",
  "isOccupied": true,
  "currentMeetingTitle": "Heti review",
  "currentMeetingOrganizer": "Nagy Anna",
  "currentMeetingEnd": "2026-06-16T10:00:00.000Z",
  "nextMeetingStart": null,
  "schedule": [
    { "start": "...", "end": "...", "title": "...", "organizer": "..." }
  ],
  "currentMeetingId": "2026-06-16T09:00:00.000Z",
  "currentMeetingCheckedIn": false,
  "checkInRequired": true,
  "autoReleaseAt": "2026-06-16T09:10:00.000Z"
}
```

Lifecycle fields: `checkInRequired` is true while a meeting is running, unconfirmed,
and inside the grace window; `autoReleaseAt` is when an unconfirmed meeting will be
released as a no-show; `currentMeetingCheckedIn` flips true after check-in.

**Errors:** HTTP 401 (token expired, live mode) · HTTP 503 (other Graph failure).

### POST `/calendar/room/:roomId/book`

Creates a new booking. Rate limited.

**Body:**
```json
{ "durationMinutes": 30, "organizer": "Kovács Péter", "title": "Design review", "startTime": "2026-06-16T10:00:00.000Z" }
```

`title`/`startTime` optional. In live mode the event is tagged with the
`MeetingRoomKiosk` category so only kiosk-created events are ever mutated.

**Response:** `{ "success": true }` (HTTP 201).  
**Errors:** HTTP 400 (invalid/missing `durationMinutes`, or > 24 h) · HTTP 409 (overlaps an existing booking) · HTTP 401 (token expired).

### POST `/calendar/room/:roomId/checkin`

Checks in to the room's currently running meeting (prevents no-show auto-release).

**Response:** `{ "success": true }` · **HTTP 409** if no meeting is running.

### POST `/calendar/room/:roomId/release`

Ends the current meeting immediately, freeing the room. In live mode only
kiosk-created events are deleted.

**Response:** `{ "success": true }` · **HTTP 409** if nothing is releasable.

### POST `/calendar/room/:roomId/extend`

Extends the current meeting if the following slot is free.

**Body:** `{ "minutes": 15 }` (1–120)

**Response:** `{ "success": true }` · **HTTP 400** (invalid minutes) · **HTTP 409** (nothing to extend / collides with the next meeting).

---

## Running Tests

### Backend unit tests (Jest)

```bash
cd backend
npm test
```

Runs all `*.spec.ts` files. Currently **99 tests** across 7 suites, including the
meeting lifecycle (check-in, no-show auto-release, release, extend), the
`AdminKeyGuard`, and the `parseGraphDateTime` / interval utilities.

### Backend e2e tests

```bash
cd backend
npx jest --config ./test/jest-e2e.json --forceExit
```

**27 tests** against a real in-process NestJS app in mock mode. Covers health,
room CRUD, config endpoints, booking (with conflict 409 and validation 400),
and the full lifecycle (check-in / release / extend).

### Frontend component tests (Vitest)

```bash
cd frontend
npm test
```

Runs all `*.test.ts(x)` files. Currently **30 tests** across 3 files:
- `SetupScreen.test.tsx` — 10 tests
- `BookingModal.test.tsx` — 10 tests
- `hooks/useRooms.test.ts` — 10 tests

### Run all tests

```bash
cd backend && npm test && npx jest --config ./test/jest-e2e.json --forceExit; cd ../frontend && npm test -- --run
```

Total: **123 tests** (71 unit + 22 e2e + 30 frontend).

---

## Local Development (without Docker)

```bash
# Terminal 1 — Backend
cd backend
npm install
npm run start:dev

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api` requests to `http://localhost:3000` automatically — no environment variables needed.

---

## Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Frontend still shows old code after editing | Vite HMR doesn't fire in Docker on Windows | `docker restart meetingroom_frontend` |
| "Kapcsolódási hiba" error screen | Backend not running or port conflict | `docker compose logs backend` |
| Graph API calls fail after ~1 hour | Token expired | Paste fresh token via `/admin` → Graph Token section |
| Room always free despite meetings | Graph token user has no calendar events | Use mock mode or use the calendar owner's token |
| `npm install` fails in container | Network issue | `docker compose down && docker compose up` |
| Port 3000 or 5173 already in use | Another service running | `docker ps` to find and stop conflicting containers |
| Setup screen appears every time | `localStorage` not persisting | Check browser privacy mode (incognito clears storage on close) |
| Rooms reset to defaults after restart | `data/rooms.json` not persisted | Ensure the Docker volume or bind-mount is configured |
| Codespace preview shows connection error | Backend not started yet | Run `cd backend && npm run start:dev` in a terminal first |
