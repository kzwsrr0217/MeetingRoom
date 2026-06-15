# MeetingRoom — Developer Guide

## Overview

MeetingRoom is a tablet/kiosk application that displays real-time meeting room availability and allows instant bookings via Microsoft Outlook. It consists of:

- **Backend** — NestJS (TypeScript) REST API, port 3000
- **Frontend** — React 19 + Vite + Tailwind CSS 4, port 5173
- **Calendar source** — Microsoft Graph API (or mock data for development)

The application is stateless: no database. All meeting data comes from Outlook via the Graph API.

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
# Clone / open the project
cd c:\Projects\MeetingRoom

# Start everything
docker compose up

# First run takes 2-3 minutes (npm install inside containers)
# Subsequent runs are fast
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
docker compose up --build
```

> **Windows HMR note:** Vite's hot module replacement does not always fire on file changes when running inside Docker Desktop on Windows (inotify limitation). After editing frontend files, run `docker restart meetingroom_frontend` to pick up changes.

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

### Frontend — `frontend/src/config.ts`

All rooms, preset organiser names, localStorage keys, and the API base URL are defined here:

```typescript
export const ROOMS = ['MMH Séd', 'MMH Balaton', 'MMH Mars', ...];
export const DEFAULT_PRESET_ORGANIZERS = ['Kovács Péter', 'Nagy Anna', ...];
export const API_BASE = 'http://localhost:3000/api';
```

To add/remove rooms: edit `ROOMS` in `config.ts`. The change propagates to the kiosk, admin dashboard, and setup screen automatically.

---

## Application Routes

| URL | Description |
|-----|-------------|
| `http://localhost:5173/` | Kiosk view — first-run shows SetupScreen |
| `http://localhost:5173/?room=MMH%20Balaton` | Kiosk view forced to a specific room |
| `http://localhost:5173/admin` | Admin dashboard (desktop-optimised) |

**First-run flow:** On first visit, `localStorage` has no home room set — the app renders the **SetupScreen** (full-screen room picker). After selecting a room, it is saved to `localStorage` under the key `meetingroom_home` and the kiosk loads.

**Reset a tablet:** Hold the clock on the kiosk for 3 seconds. The home room is cleared from `localStorage` and the SetupScreen appears again.

---

## Development Modes

### Mock Mode (no Azure required)

Set `USE_MOCK_DATA=true` in `docker-compose.yml` (the default).

Mock behavior per room:

| Room | Status |
|------|--------|
| Balaton | Always occupied (VIP room) |
| Mars | Occupied after 14:00 |
| Séd | Occupied during even hours |
| Others | Always free |

### Live Mode (Microsoft Graph)

Requires a valid access token. See [Updating the Graph API Token](#updating-the-graph-api-token) below.

---

## Updating the Graph API Token

The backend reads the token from the `GRAPH_TEMP_TOKEN` environment variable. Do not put the token in source code.

**Steps to refresh:**

1. Go to [Microsoft Graph Explorer](https://developer.microsoft.com/en-us/graph/graph-explorer)
2. Sign in with the Outlook account that owns the meeting room calendars
3. Click your avatar → **Access token** → copy the token
4. Open `backend/.env` and paste the token:
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
├── backend/
│   └── src/
│       ├── main.ts                         # Entry point, CORS, port
│       ├── app.module.ts                   # Root module, loads .env
│       └── calendar/
│           ├── calendar.module.ts          # Selects Mock vs. Graph service
│           ├── calendar.controller.ts      # HTTP routes (/api/*)
│           ├── calendar.service.ts         # Abstract base class
│           ├── mock-calendar.service.ts    # Simulated data
│           ├── mock-calendar.service.spec.ts   # Unit tests
│           ├── calendar.controller.spec.ts     # Controller unit tests
│           ├── graph-calendar.service.ts   # Real Microsoft Graph calls
│           └── domain/
│               └── room-status.model.ts    # RoomStatus data model
│   └── test/
│       └── app.e2e-spec.ts                 # E2E integration tests
├── frontend/
│   └── src/
│       ├── main.tsx                        # React entry, strict mode
│       ├── test-setup.ts                   # Vitest + jest-dom setup
│       ├── config.ts                       # Rooms, names, API URL, storage keys
│       ├── App.tsx                         # Routing: /admin | SetupScreen | KioskApp
│       ├── hooks/
│       │   ├── useRoomStatus.ts            # API polling, booking logic
│       │   ├── useCurrentTime.ts           # Live clock
│       │   └── useWakeLock.ts              # Screen Wake Lock API
│       └── components/
│           ├── RoomDisplay.tsx             # Main kiosk layout
│           ├── Header.tsx                  # Clock + long-press reset
│           ├── StatusCard.tsx              # Free / Occupied + booking btn
│           ├── MeetingDetails.tsx          # Current meeting info + countdown
│           ├── Timeline.tsx                # Day schedule + advance booking
│           ├── BookingModal.tsx            # Duration + name picker modal
│           ├── SetupScreen.tsx             # First-run room picker
│           ├── AdminView.tsx               # Admin dashboard (/admin)
│           ├── SetupScreen.test.tsx        # Component tests
│           └── BookingModal.test.tsx       # Component tests
├── docker-compose.yml
├── .gitignore
└── docs/
```

---

## API Reference

Base URL: `http://localhost:3000/api`

### GET `/health`

Returns backend status and current mode.

**Response:**
```json
{
  "status": "ok",
  "mode": "mock",
  "timestamp": "2026-06-15T19:15:13.465Z"
}
```

`mode` is either `"mock"` or `"graph"`.

---

### GET `/calendar/room/:roomId/status`

Returns the current status of a room.

**URL parameter:** `roomId` — room name (URL-encoded), e.g. `MMH%20S%C3%A9d`

**Response:**
```json
{
  "roomId": "MMH Séd",
  "isOccupied": true,
  "currentMeetingTitle": "Heti review",
  "currentMeetingOrganizer": "Nagy Anna",
  "currentMeetingEnd": "2026-06-15T10:00:00.000Z",
  "nextMeetingStart": null,
  "schedule": [
    {
      "start": "2026-06-15T08:00:00.000Z",
      "end": "2026-06-15T10:00:00.000Z",
      "title": "Heti review",
      "organizer": "Nagy Anna"
    }
  ]
}
```

When free: `currentMeetingTitle`, `currentMeetingOrganizer`, `currentMeetingEnd` are `null`; `nextMeetingStart` is set or `null` if no more meetings today.

---

### POST `/calendar/room/:roomId/book`

Creates a new booking.

**Body:**
```json
{
  "durationMinutes": 30,
  "organizer": "Kovács Péter",
  "startTime": "2026-06-15T10:00:00.000Z"
}
```

`startTime` is optional — omit for an immediate booking.

**Response:** `true` on success (HTTP 201).

**Error:** HTTP 400 if `durationMinutes` is missing.

---

### POST `/calendar/room/:roomId/checkin`

Confirms attendee check-in (PoC stub — logs only).

**Response:** `{ "success": true }` (HTTP 201)

---

## Running Tests

### Backend unit tests (Jest)

```bash
cd backend
npm test
```

Runs `*.spec.ts` files: `mock-calendar.service.spec.ts` + `calendar.controller.spec.ts`.

### Backend e2e tests

```bash
cd backend
npx jest --config ./test/jest-e2e.json --forceExit
```

Tests all API routes against a real in-process NestJS app in mock mode.

### Frontend component tests (Vitest)

```bash
cd frontend
npm test
```

Runs `*.test.tsx` files: `SetupScreen.test.tsx` + `BookingModal.test.tsx`.

### Run all tests

```bash
cd backend && npm test --forceExit; cd ../frontend && npm test
```

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

---

## Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Frontend still shows old code after editing | Vite HMR doesn't fire in Docker on Windows | `docker restart meetingroom_frontend` |
| "Kapcsolódási hiba" error screen | Backend not running or port conflict | `docker compose logs backend` |
| Graph API calls fail after ~1 hour | Token expired | Update `GRAPH_TEMP_TOKEN` in `backend/.env` and restart backend |
| Room always free despite meetings | Graph token user has no calendar events | Use mock mode or use the calendar owner's token |
| `npm install` fails in container | Network issue | `docker compose down && docker compose up` |
| Port 3000 or 5173 already in use | Another service running | `docker ps` to find and stop conflicting containers |
| Setup screen appears every time | `localStorage` not persisting | Check browser privacy mode (incognito clears storage on close) |
