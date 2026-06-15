# MeetingRoom — Admin Guide

## Overview

This guide covers deployment, configuration, token management, and future infrastructure options for the MeetingRoom kiosk system.

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
| 5173 | Frontend UI (Vite) |

Ensure these ports are not occupied by other services on the host.

### Starting the Application

```powershell
# From the project root
cd C:\Projects\MeetingRoom
docker compose up -d       # Start in background
docker compose logs -f     # Follow logs
docker compose down        # Stop
```

**First start:** Takes 2–4 minutes for `npm install` to run inside the containers. Subsequent starts are fast (packages are cached in Docker volumes).

---

## Environment Variables

All backend configuration lives in `backend/.env`. This file is mounted into the container at runtime.

```env
USE_MOCK_DATA=false       # "true" = simulated data, no Azure needed
PORT=3000

AZURE_TENANT_ID=          # Microsoft Entra tenant ID
AZURE_CLIENT_ID=          # App registration client ID  
AZURE_CLIENT_SECRET=      # App registration secret
```

> **POC caveat:** The Azure AD credentials above are currently placeholder values. The Graph API connection uses a manually refreshed 1-hour token (see below). The `.env` file's Azure values are not yet used by the application.

After changing `.env`:
```powershell
docker compose restart backend
```

---

## Microsoft Graph Token Management (Current POC Workflow)

Because proper Azure AD app registration is not yet available, a manually obtained delegated token is used. This token expires in approximately 1 hour.

### How to Refresh the Token

1. Open **Microsoft Graph Explorer**: https://developer.microsoft.com/en-us/graph/graph-explorer
2. Click **Sign in** — use the Microsoft account that owns the meeting room calendars
3. After sign-in, click your **profile picture** (top right) → **Access token**
4. Copy the entire token string
5. Open the file: `backend\src\calendar\graph-calendar.service.ts`
6. Find the `TEMP_TOKEN` constant (line ~12) and replace its value with the new token
7. Save the file — NestJS hot-reload will pick it up automatically if the container is running with `start:dev`

If hot-reload is not active:
```powershell
docker compose restart backend
```

### Token Lifetime

- Standard Microsoft Graph delegated tokens: **60–75 minutes**
- The application will return HTTP errors from the Graph API once the token expires
- The frontend will display "Nem sikerült kapcsolódni a szerverhez" (connection error)

### Future: Proper Token Refresh

When Azure AD app registration becomes available, the MSAL library (`@azure/msal-node`) already installed in the backend will handle automatic token acquisition and refresh. See [Improvements](IMPROVEMENTS.md) for the implementation plan.

---

## Switching to Mock Mode

For demos where network connectivity to Microsoft 365 is unavailable or token has expired, switch to mock mode:

1. Edit `backend/.env`:
   ```env
   USE_MOCK_DATA=true
   ```
2. Restart backend:
   ```powershell
   docker compose restart backend
   ```

Mock mode needs no internet access and never expires. Room behavior in mock mode:

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

The backend logs all API requests and Graph API calls, including token errors.

---

## Kiosk Display Setup (Tablet)

The frontend is designed as a full-screen kiosk for a 10" landscape tablet.

**Browser setup (recommended):**
1. Open Chrome or Edge on the tablet
2. Navigate to `http://<host-ip>:5173`
3. Press **F11** for full-screen
4. For permanent kiosk mode (Chrome), create a shortcut with:
   ```
   chrome.exe --kiosk --app=http://<host-ip>:5173
   ```

**Setting the room for a specific tablet:**

Each tablet displays one room by default. The default room is `MMH Séd`. To configure a tablet for a different room, navigate to:
```
http://<host-ip>:5173/?room=MMH%20Balaton
```

The URL parameter `?room=<name>` sets the displayed room. Users can still navigate to other rooms from the UI (auto-returns after 60 seconds).

**Host IP for tablet access:**

If the tablet is on the same network as the Docker Desktop host:
```powershell
# Find the host IP
ipconfig
# Look for "IPv4 Address" under your Wi-Fi or LAN adapter
```

Use that IP instead of `localhost` when accessing from the tablet.

---

## Updating the Application

### Code changes (hot-reload — no restart needed)

Both backend (NestJS) and frontend (Vite) run in watch mode and reload on file save.

### Dependency changes (`package.json`)

```powershell
docker compose down
docker compose up
# npm install runs automatically on start
```

### Full rebuild

```powershell
docker compose down -v   # Also removes named volumes
docker compose up
```

---

## Backup & Recovery

The application has no database — all data is in Microsoft Outlook. There is nothing to back up except:

- `backend/.env` — credentials and configuration
- `backend/src/calendar/graph-calendar.service.ts` — contains the current `TEMP_TOKEN`

---

## Future Deployment Options

### Podman (same host, rootless containers)

Podman is compatible with Docker Compose via `podman-compose` or the Docker Compose plugin.

```bash
# Install podman-compose
pip install podman-compose

# Run
podman-compose up
```

Main difference: Podman is rootless by default. Ports below 1024 require additional configuration. Ports 3000 and 5173 work without changes.

### Kubernetes / OpenShift

See [Improvements](IMPROVEMENTS.md#kubernetes--openshift) for the production-readiness checklist before deploying to Kubernetes. Key prerequisites:

1. Fix `VITE_API_URL` to use environment variable (currently hardcoded)
2. Implement MSAL token refresh (eliminate hardcoded token)
3. Build production Docker images (not dev servers)
4. Create Kubernetes manifests (Deployment, Service, ConfigMap, Secret)

### Azure Container Apps

Recommended Azure target. Supports Docker Compose-like configuration via Azure Container Apps environments.

Prerequisites same as Kubernetes, plus:
- Azure subscription
- Azure Container Registry for image storage
- Azure Key Vault for secrets (replace `.env` file)
- Managed Identity for Graph API access (eliminates client secret)

---

## Security Notes

- The `backend/.env` file contains credentials. Do not commit it to git (it is in `.gitignore`).
- The `TEMP_TOKEN` in `graph-calendar.service.ts` is a bearer token. Do not commit it to git either — treat the file as sensitive while the hardcoded token is present.
- CORS is currently enabled for all origins in the backend (`main.ts`). Restrict this before production deployment.
- The check-in endpoint (`POST /api/calendar/room/:roomId/checkin`) has no authentication. Any HTTP client can call it.
