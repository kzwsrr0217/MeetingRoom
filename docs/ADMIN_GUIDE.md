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

Open the admin dashboard at:

```
http://localhost:5173/admin
```

The dashboard has four sections:

### 1. Tárgyalók kezelése — Room Management

- **Live status grid** — all rooms polled every 15 seconds with occupancy, meeting title, organiser, and end time
- **Add room** — enter a name and the Outlook resource-mailbox email, click **+ Hozzáadás**
  - In **live (Graph) mode** the `calendarEmail` is **required** for the room to
    show real availability, and the mailbox must be added to the app's Application
    Access Policy group — see [GO_LIVE_TASKS.md → Adding rooms later](GO_LIVE_TASKS.md#adding-or-removing-rooms-later-extensibility).
    First-time live setup + one test tablet: [GO_LIVE_TASKS.md → First test with ONE tablet](GO_LIVE_TASKS.md#first-test-with-one-tablet--step-by-step).
- **Edit a room** — click the ✎ pencil button on any room card to rename it or update its email
- **Delete a room** — click ✕ on a room card (requires confirmation)
- **Kiosk link** — click ↗ on any card to open that room's kiosk view in a new tab
- **Reset** — "Visszaállítás alapértelmezettre" restores the 6 default rooms

Changes take effect immediately across all kiosks (they poll `GET /api/rooms` every 15 seconds on the setup screen).

### 2. Microsoft Graph Token

- **Current status** — shows whether a token is loaded, when it expires, and how many minutes remain
- **Paste a fresh token** — paste into the text area and click **Token alkalmazása**
  - The backend updates the live connection immediately (no restart required)
  - The token is also saved to `backend/.env` so it survives a backend restart

### 3. Foglalási nevek — Shared Preset Names

- Shows the quick-pick organiser names used in the booking modal on all kiosks
- Add a name and click **+ Hozzáad** (or press Enter)
- Remove individual names with the × button
- **Shared** — stored in `backend/data/config.json`, not per-browser localStorage; every kiosk and the admin page sees the same list immediately on next refresh

### 4. Rendszer — System Info

- API and kiosk URLs
- Per-room kiosk links for quick access
- Long-press reset instructions for tablets

---

## Environment Variables

All backend configuration lives in `backend/.env`. This file is mounted into the container at runtime.

```env
USE_MOCK_DATA=true        # "true" = simulated data, no Azure needed
PORT=3000
GRAPH_TEMP_TOKEN=         # Paste a fresh delegated Graph token here

# Azure AD app (MSAL) — when all three are set the backend auto-refreshes tokens
AZURE_TENANT_ID=
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=

# Security & behaviour
ADMIN_API_KEY=            # protects admin/mutating endpoints; empty = fail-open (POC)
CHECKIN_GRACE_MIN=10      # minutes before a no-show is auto-released
AUTO_RELEASE=true         # mock: free no-show kiosk bookings
FRONTEND_URL=http://localhost:8080   # CORS allowlist (split dev setup only)
```

See `backend/.env.example` and the root `.env.example` for the full list.

> **Admin key:** when `ADMIN_API_KEY` is set, open **Admin → System → Admin kulcs**
> and paste the same value once per admin browser — it is sent as `x-admin-key`
> on room/token/preset changes. Panel actions (book/check-in/release/extend) are
> not admin-gated but are rate limited.

> **Production / Podman:** for the compiled multi-container stack (no dev servers)
> see [PODMAN.md](PODMAN.md) — `docker-compose.prod.yml` (+ `docker-compose.corpca.yml`
> on the Zscaler network).

> **Important:** The `USE_MOCK_DATA` value in `docker-compose.yml`'s `environment:` block takes precedence over `.env`. Edit `docker-compose.yml` directly when running in Docker.

After changing `.env` or `docker-compose.yml`:
```powershell
docker compose restart backend
```

---

## Microsoft Graph Token Management (Current POC Workflow)

Because Azure AD app registration is not yet available, a manually obtained delegated token is used. This token expires in approximately 60–75 minutes.

### Recommended: Refresh via Admin UI (no restart needed)

1. Open **Microsoft Graph Explorer**: https://developer.microsoft.com/en-us/graph/graph-explorer
2. Sign in with the Microsoft account that owns the meeting room calendars
3. After sign-in, click your **profile picture** (top right) → **Access token**
4. Copy the entire token string
5. Go to http://localhost:5173/admin
6. Paste the token into the **Microsoft Graph Token** field → click **Token alkalmazása**

The backend updates the live connection instantly. The token is also written to `backend/.env` for persistence across restarts.

### Manual: Edit `.env` (requires backend restart)

```env
GRAPH_TEMP_TOKEN=eyJ0eXAiOiJKV1Qi...
USE_MOCK_DATA=false
```

```powershell
docker compose restart backend
```

### Token Lifetime

- Standard Microsoft Graph delegated tokens: **60–75 minutes**
- When the token expires, the frontend shows "Kapcsolódási hiba" (connection error)
- The admin dashboard token section shows the remaining minutes and highlights the field when expired

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

Bookings made on the kiosk flip the room to occupied for the booked duration (in-memory; resets on backend restart).

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

Update `docker-compose.yml` so the frontend can reach the backend from the tablets:
```yaml
environment:
  - VITE_API_URL=http://<host-ip>:3000
```

Then rebuild:
```powershell
docker compose up --build
```

### First-Run Setup (per tablet)

On first visit, the kiosk shows a full-screen room picker — **"Melyik tárgyaló ez a kioszk?"** (Which meeting room is this kiosk?). The room list comes from the backend, so any rooms added via the admin dashboard appear here.

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

Back up the following files (not in git):

| File | Contents |
|------|----------|
| `backend/.env` | `GRAPH_TEMP_TOKEN`, `USE_MOCK_DATA` |
| `backend/data/rooms.json` | Configured room list |
| `backend/data/config.json` | Shared preset organiser names |

Source code is in git: `https://github.com/kzwsrr0217/MeetingRoom`

The application has no database — meeting events live in Microsoft Outlook. Kiosk bookings in live mode write directly to the calendar owner's Outlook.

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
3. Externalise `VITE_API_URL` as a build-time or runtime env var
4. Create Deployment, Service, ConfigMap, and Secret manifests
5. Mount `data/` as a PersistentVolumeClaim so rooms.json survives pod restarts

### Azure Container Apps

Recommended Azure target. Additional prerequisites:
- Azure Container Registry for image storage
- Azure Key Vault for `GRAPH_TEMP_TOKEN` secret
- Managed Identity for Graph API access (eliminates client secret entirely)

---

## Security Notes

- `backend/.env` contains credentials — never commit it to git (it is in `.gitignore`)
- `GRAPH_TEMP_TOKEN` is a bearer token with delegated user permissions — treat it as a password
- `backend/data/rooms.json` and `config.json` are git-ignored; do not commit them
- CORS is currently enabled for all origins. Restrict to the frontend origin before production deployment
- The admin dashboard has no authentication — restrict network access or add HTTP basic auth before exposing it beyond the local network
- The check-in endpoint (`POST /api/calendar/room/:roomId/checkin`) has no authentication
