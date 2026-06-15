# MeetingRoom — Developer Guide

## Overview

MeetingRoom is a tablet/kiosk application that displays real-time meeting room availability and allows instant bookings via Microsoft Outlook. It consists of:

- **Backend** — NestJS (TypeScript) REST API, port 3000
- **Frontend** — React 19 + Vite + Tailwind CSS, port 5173
- **Calendar source** — Microsoft Graph API (or mock data for development)

The application is stateless: no database. All meeting data comes from Outlook via the Graph API.

---

## Prerequisites

| Tool | Minimum version | Notes |
|------|----------------|-------|
| Docker Desktop | 4.x | Enable WSL 2 backend on Windows |
| Node.js | 20.x LTS | Only needed for local (non-Docker) dev |
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
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000/api

**Stop:**
```bash
docker compose down
```

**Rebuild after package.json changes:**
```bash
docker compose down
docker compose up --build
```

> The `node_modules` directories live inside the containers (anonymous volumes), so host-side `node_modules` are intentionally absent.

---

## Configuration

### Backend — `backend/.env`

```env
USE_MOCK_DATA=false   # Set to "true" to use mock data without Azure
PORT=3000

# Azure AD — get these from IT Security or Azure Portal
AZURE_TENANT_ID=<your-tenant-id>
AZURE_CLIENT_ID=<your-client-id>
AZURE_CLIENT_SECRET=<your-client-secret>
```

**Changes to `.env` require a container restart:**
```bash
docker compose restart backend
```

### Frontend — `frontend/src/hooks/useRoomStatus.ts`

> **Known issue:** The backend URL is currently hardcoded as `http://localhost:3000/api` in the hook.  
> The `VITE_API_URL` environment variable set in `docker-compose.yml` is not yet wired up.  
> For Docker Desktop this is fine (all ports on localhost). For other environments, see [Improvements](IMPROVEMENTS.md).

---

## Development Modes

### Mock Mode (no Azure required)

Set `USE_MOCK_DATA=true` in `backend/.env` **or** edit `docker-compose.yml`:
```yaml
environment:
  - USE_MOCK_DATA=true
```

Mock behavior by room:
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

The backend currently uses a hardcoded 1-hour delegated token in `backend/src/calendar/graph-calendar.service.ts`.

**Steps to refresh:**

1. Go to [Microsoft Graph Explorer](https://developer.microsoft.com/en-us/graph/graph-explorer)
2. Sign in with the Outlook account whose calendar the rooms are on
3. Click your avatar → **Access token** → copy the token
4. Open `backend/src/calendar/graph-calendar.service.ts`
5. Replace the `TEMP_TOKEN` constant value
6. Restart the backend:
   ```bash
   docker compose restart backend
   ```

> **Note:** This token expires in ~1 hour. The MSAL library (`@azure/msal-node`) is installed for future automatic token refresh but is not yet wired up.

---

## Project Structure

```
MeetingRoom/
├── backend/
│   └── src/
│       ├── main.ts                     # Entry point, CORS, port
│       ├── app.module.ts               # Root module, loads .env
│       └── calendar/
│           ├── calendar.module.ts      # Module — selects Mock vs. Graph service
│           ├── calendar.controller.ts  # HTTP routes
│           ├── calendar.service.ts     # Abstract base class
│           ├── mock-calendar.service.ts    # Simulated data
│           ├── graph-calendar.service.ts   # Real Microsoft Graph calls
│           └── domain/
│               └── room-status.model.ts    # RoomStatus data model
├── frontend/
│   └── src/
│       ├── main.tsx                    # React entry, strict mode
│       ├── App.tsx                     # Root: room routing, auto-return timer
│       ├── hooks/
│       │   ├── useRoomStatus.ts        # API polling (10s), booking logic
│       │   └── useCurrentTime.ts       # Clock hook
│       └── components/
│           ├── RoomDisplay.tsx         # Main layout
│           ├── Header.tsx              # Room name, clock
│           ├── StatusCard.tsx          # Free / Occupied indicator
│           ├── MeetingDetails.tsx      # Current meeting info
│           └── Timeline.tsx            # Day schedule, advance booking modal
├── docker-compose.yml
└── docs/                               # ← You are here
```

---

## API Reference

Base URL: `http://localhost:3000/api`

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
  "nextMeetingStart": null,
  "schedule": [
    {
      "start": "2026-06-15T08:00:00.000Z",
      "end": "2026-06-15T09:00:00.000Z",
      "title": "Heti review",
      "organizer": "Nagy Anna"
    }
  ]
}
```

### POST `/calendar/room/:roomId/book`

Creates a new booking.

**Body:**
```json
{
  "durationMinutes": 15,
  "organizer": "Kis Péter",
  "startTime": "2026-06-15T10:00:00.000Z"
}
```

`startTime` is optional — if omitted, booking starts immediately.

**Response:** `true` on success, `false` on failure.

### POST `/calendar/room/:roomId/checkin`

Confirms attendee check-in (PoC stub — logs only).

**Response:** `{ "success": true }`

---

## Available Rooms (configured in frontend)

| Room name | Default? |
|-----------|----------|
| MMH Séd | Yes (tablet home) |
| MMH Balaton | |
| MMH Mars | |
| MMH Tihany | |
| MMH Bakony | |
| MMH Kis Balaton | |

To change the default room, edit `App.tsx`:
```typescript
const HOME_ROOM = "MMH Séd"; // Change this
```

To add/remove rooms, edit the room list in `RoomDisplay.tsx` (the room picker modal).

---

## Running Tests

```bash
# Inside the backend container
docker compose exec backend npm run test

# Or directly on host (requires Node 20)
cd backend
npm test
```

---

## Local Development (without Docker)

If you prefer to run services directly on your machine:

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
| Frontend shows "Nem sikerült kapcsolódni a szerverhez" | Backend not running or port conflict | `docker compose logs backend` |
| Graph API calls fail after ~1 hour | Token expired | Replace `TEMP_TOKEN` in `graph-calendar.service.ts` |
| Room always shows as free despite meetings | Graph API query uses `/me/calendarview` — the token user must have meetings in their calendar | Use mock mode or use the calendar owner's token |
| `npm install` fails in container | Network issue or npm registry problem | `docker compose down && docker compose up` to retry |
| Port 3000 or 5173 already in use | Another service running | `docker ps` to find and stop conflicting containers |
