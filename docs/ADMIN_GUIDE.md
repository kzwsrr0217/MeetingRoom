# MeetingRoom — Admin Guide

## Overview

This guide covers deployment, configuration, token management, and infrastructure options for the MeetingRoom kiosk system.

**Current state:** POC running on Docker Desktop (Windows).  
**Roadmap:** Podman → Kubernetes → OpenShift → Azure Container Apps.

---

## Current Environment: Docker Desktop (Windows)

### System Requirements

| Component | Requirement |
|-----------|-------------|
| OS | Windows 10/11 (64-bit) |
| CPU | 4 cores recommended |
| RAM | 8 GB minimum (4 GB for containers) |
| Disk | 5 GB free |
| Docker Desktop | 4.x or later with WSL 2 backend |
| Network | Access to `graph.microsoft.com` (for live mode) |

### Ports Used

| Port | Service |
|------|---------|
| 3000 | Backend API (NestJS) |
| 5173 | Frontend UI (Vite) — kiosk at `/`, admin at `/admin` |

Ensure these ports are not occupied by other services on the host.

### Starting the Application

```powershell
# From the project root
cd C:\Projects\MeetingRoom
docker compose up -d       # Start in background
docker compose logs -f     # Follow logs
docker compose down        # Stop
```

**First start:** Takes 2–4 minutes for `npm install` to run inside the containers. Subsequent starts are fast.

---

## Admin Dashboard

A desktop-optimised admin view is available at:

```
http://localhost:5173/admin
```

The admin dashboard shows:

- **Live room status grid** — all rooms polled every 15 seconds, with occupancy, end time, and a link to each room's kiosk view
- **Backend health pill** — online/offline indicator + current mode (mock or graph)
- **Preset names** — manage the list of quick-select organiser names shown in the booking modal (stored in `localStorage` of the admin browser)
- **System info** — API URL, kiosk URL, per-room kiosk links, token status warning in graph mode
- **Tablet reset instructions** — how to clear a tablet's room selection via long-press

> **Note:** Preset names are stored in `localStorage` per browser. Names set in the admin dashboard do not automatically propagate to the tablets. Each tablet manages its own list (also configurable from the tablet itself via the booking modal).

---

## Environment Variables

All backend configuration lives in `backend/.env`. This file is mounted into the container at runtime.

```env
USE_MOCK_DATA=true        # "true" = simulated data, no Azure needed
PORT=3000
GRAPH_TEMP_TOKEN=         # Paste a fresh delegated Graph token here
```

> **Important:** The `USE_MOCK_DATA` value in `docker-compose.yml`'s `environment:` block takes precedence over `.env`. Edit `docker-compose.yml` directly when running in Docker.

After changing `.env` or `docker-compose.yml`:
```powershell
docker compose restart backend
```

---

## Microsoft Graph Token Management (Current POC Workflow)

Because Azure AD app registration is not yet available, a manually obtained delegated token is used. This token expires in approximately 60–75 minutes.

### How to Refresh the Token

1. Open **Microsoft Graph Explorer**: https://developer.microsoft.com/en-us/graph/graph-explorer
2. Click **Sign in** — use the Microsoft account that owns the meeting room calendars
3. After sign-in, click your **profile picture** (top right) → **Access token**
4. Copy the entire token string
5. Open `backend\.env` and paste it:
   ```env
   GRAPH_TEMP_TOKEN=eyJ0eXAiOiJKV1Qi...
   USE_MOCK_DATA=false
   ```
6. Restart the backend:
   ```powershell
   docker compose restart backend
   ```

### Token Lifetime

- Standard Microsoft Graph delegated tokens: **60–75 minutes**
- When the token expires, the frontend will show "Kapcsolódási hiba" (connection error)
- The admin dashboard will show a warning badge next to the mode indicator when in graph mode

### Future: Proper Token Refresh

When Azure AD app registration becomes available, the MSAL library (`@azure/msal-node`) already installed in the backend will handle automatic token acquisition and refresh. See [IMPROVEMENTS.md](IMPROVEMENTS.md) for the implementation plan.

---

## Switching to Mock Mode

For demos where network connectivity to Microsoft 365 is unavailable or the token has expired:

1. Edit `docker-compose.yml`:
   ```yaml
   environment:
     - USE_MOCK_DATA=true
   ```
2. Restart the backend:
   ```powershell
   docker compose restart backend
   ```

Mock mode requires no internet access and never expires. The admin dashboard shows a yellow **"mock"** badge.

Room behavior in mock mode:

| Room contains | Status |
|---------------|--------|
| "Balaton" | Always occupied |
| "Mars" | Occupied after 14:00 |
| "Séd" | Occupied in even hours |
| Anything else | Always free |

---

## Container Health & Logs

```powershell
# Service status
docker compose ps

# Backend logs (last 100 lines)
docker compose logs --tail=100 backend

# Frontend logs
docker compose logs --tail=100 frontend

# Follow both in real time
docker compose logs -f
```

The backend logs all API requests, mock bookings, and Graph API calls including token errors.

### Health endpoint

```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/health" | Select-Object -ExpandProperty Content
```

Returns: `{"status":"ok","mode":"mock","timestamp":"..."}` — confirms the backend is running and shows the current mode.

---

## Kiosk Tablet Setup

### Network Requirements

The tablets and the Docker Desktop host must be on the **same network**. Find the host IP:

```powershell
ipconfig
# Look for "IPv4 Address" under your Wi-Fi or Ethernet adapter
```

Use `http://<host-ip>:5173` on the tablets instead of `http://localhost:5173`.

### First-Run Setup (per tablet)

On first visit, the kiosk shows a full-screen room picker — **"Melyik tárgyaló ez a kioszk?"** (Which meeting room is this kiosk?). Select the room. The choice is saved to the browser's `localStorage` and persists across reloads.

**Steps for each tablet:**
1. Open Chrome or Edge on the tablet
2. Navigate to `http://<host-ip>:5173`
3. Select the room from the picker
4. Press F11 (or use Chrome kiosk mode) for full screen

**Chrome kiosk mode shortcut** (create on the tablet desktop):
```
chrome.exe --kiosk --app=http://<host-ip>:5173
```

### Resetting a Tablet's Room

If a tablet needs to be re-assigned to a different room:

1. On the kiosk screen, **hold the clock area for 3 seconds**
2. The room is cleared from `localStorage` and the setup screen appears
3. Select the new room

Alternatively, from a keyboard:
1. Open browser developer tools (F12)
2. Run: `localStorage.removeItem('meetingroom_home'); location.reload()`

### PWA Install

The kiosk supports installation as a Progressive Web App:
- Chrome on Android/iOS: Share → Add to Home Screen
- Chrome on desktop: Address bar → Install icon

This gives a standalone fullscreen app experience without browser chrome.

---

## Updating the Application

### After editing source files (hot-reload)

Both NestJS and Vite run in watch mode inside Docker. Changes to source files trigger automatic reload.

> **Windows caveat:** Vite's HMR does not always fire on Windows due to inotify limitations in Docker Desktop. If the frontend does not update after saving a file, run:
> ```powershell
> docker restart meetingroom_frontend
> ```

### After changing dependencies (`package.json`)

```powershell
docker compose down
docker compose up
# npm install runs automatically on container start
```

### Full rebuild

```powershell
docker compose down -v   # Also removes cached node_modules volumes
docker compose up
```

---

## Backup & Recovery

The application has no database — all meeting data lives in Microsoft Outlook. Back up:

- `backend/.env` — contains `GRAPH_TEMP_TOKEN` and mode configuration

Source code is in git: `https://github.com/kzwsrr0217/MeetingRoom`

---

## Future Deployment Options

### Podman

Compatible with Docker Compose via `podman-compose`:
```bash
pip install podman-compose
podman-compose up
```

### Kubernetes / OpenShift

Key prerequisites before deploying:
1. Build production Docker images (not dev servers with hot-reload)
2. Implement MSAL token refresh (eliminate manual `GRAPH_TEMP_TOKEN`)
3. Externalise `API_BASE` in `frontend/src/config.ts` as a build-time env var
4. Create Deployment, Service, ConfigMap, and Secret manifests

### Azure Container Apps

Recommended Azure target. Additional prerequisites:
- Azure Container Registry for image storage
- Azure Key Vault for `GRAPH_TEMP_TOKEN` secret
- Managed Identity for Graph API access (eliminates client secret entirely)

---

## Full Admin Dashboard — Design Proposal

The current `/admin` page is a read-only monitoring view. Below is a design for a full management interface that would let admins configure the system without touching code or config files.

### Planned Features

#### Room Management (CRUD)
- **View all rooms** — the live status grid already exists
- **Add a room** — form with name, display name, Outlook calendar email (for Graph API), floor/location tag
- **Edit a room** — rename, reassign Outlook mailbox, deactivate without deleting
- **Delete a room** — with confirmation; removes it from all kiosks immediately
- **Room ordering** — drag-to-reorder for consistent display across devices

#### Live Booking Management
- **Active bookings table** — room, organizer, start, end, source (kiosk / Outlook)
- **Force-end a meeting** — emergency cancel (writes to Graph API or clears mock state)
- **Extend a meeting** — add 15/30 min to the current booking
- **Create a booking** — admin books any room for any time slot from the dashboard

#### Token Management UI
- **Paste a new Graph token** — text field + "Apply" button, no file editing needed
- **Token expiry countdown** — shows how many minutes remain on the current token
- **One-click mock/live toggle** — no docker-compose editing needed

#### Shared Configuration
- **Preset organiser names** — currently per-browser localStorage; a backend endpoint would make these global across all kiosks and the admin page
- **Kiosk assignment** — map a tablet's ID (device fingerprint or manually entered name) to its home room

#### Audit Log
- Last 100 bookings: timestamp, room, organizer, duration, source
- Token refresh history

---

### Architecture Needed

The current app is stateless (no database). To support the above:

**1. Room config persistence**

Add `backend/data/rooms.json` (git-ignored, lives in a Docker volume):
```json
[
  { "id": "mmh-sed", "name": "MMH Séd", "calendarEmail": "sed@company.hu" },
  { "id": "mmh-balaton", "name": "MMH Balaton", "calendarEmail": "balaton@company.hu" }
]
```

New NestJS module: `RoomsModule` with `GET /api/rooms`, `POST /api/rooms`, `PATCH /api/rooms/:id`, `DELETE /api/rooms/:id`.

The frontend's `config.ts` `ROOMS` array would be replaced by a `GET /api/rooms` call on app startup.

**2. Shared preset names**

Add `GET /api/config/preset-names` and `PUT /api/config/preset-names` endpoints. The frontend reads from the API instead of localStorage (falls back to defaults if offline).

**3. Token management endpoint**

Add `PUT /api/config/graph-token` — accepts a new token, writes it to the running service and to `.env`. Requires a simple admin secret header to prevent anyone from replacing the token.

**4. Booking management**

The Graph Calendar Service already has `bookRoom`. Add `DELETE /api/calendar/room/:roomId/booking/:eventId` to cancel, and `PATCH` to extend. In mock mode these just manipulate the in-memory store.

**5. Audit log**

An in-memory ring buffer (last 100 entries) exposed via `GET /api/audit`. No database needed for a POC; persist to a JSON file for a production version.

---

### Suggested Implementation Order

| Priority | Feature | Effort |
|----------|---------|--------|
| High | Token management UI (paste + apply) | ~2h |
| High | Room CRUD (JSON file backend) | ~4h |
| High | Shared preset names (backend endpoint) | ~2h |
| Medium | Active bookings table | ~3h |
| Medium | Force-end / extend meeting | ~2h |
| Low | Audit log | ~2h |
| Low | Kiosk assignment map | ~3h |

The token management UI and shared preset names give the biggest day-to-day value with the least work.

---

## Security Notes

- `backend/.env` contains credentials — never commit it to git (it is in `.gitignore`)
- `GRAPH_TEMP_TOKEN` is a bearer token with delegated user permissions — treat it as a password
- CORS is currently enabled for all origins. Restrict to the frontend origin before production deployment
- The check-in endpoint (`POST /api/calendar/room/:roomId/checkin`) has no authentication — any HTTP client can call it
