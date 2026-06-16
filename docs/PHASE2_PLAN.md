# MeetingRoom — Phase 2: Production Implementation Plan

This document describes the steps to go from the accepted POC to a production deployment integrated with Azure AD and the real Outlook room calendars.

---

## Prerequisites (before starting Phase 2)

- [ ] Azure AD tenant access and permission to create App Registrations
- [ ] Exchange Online room mailboxes exist (or IT confirms room resource accounts)
- [ ] Decision on hosting: Azure Container Apps (recommended) or on-premise server
- [ ] Decision on tablet hardware (Android + Chrome or iPad + Safari)

---

## Step 1 — Azure AD App Registration

### What to create

In the Azure Portal → **Azure Active Directory** → **App registrations** → **New registration**:

| Field | Value |
|-------|-------|
| Name | `MeetingRoom Kiosk` |
| Supported account types | Accounts in this organizational directory only (single tenant) |
| Redirect URI | Leave blank (daemon app, no user login) |

### API Permissions to request

Under **API permissions** → **Add a permission** → **Microsoft Graph** → **Application permissions**:

| Permission | Purpose |
|-----------|---------|
| `Calendars.Read` | Read meeting room calendars |
| `Calendars.ReadWrite` | Create bookings in room calendars |

After adding: click **Grant admin consent for [tenant]** — this requires a Global Admin to approve.

### Client secret

Under **Certificates & secrets** → **New client secret**:
- Description: `MeetingRoom Backend`
- Expiry: 24 months (set a calendar reminder to rotate before expiry)
- Copy the **Value** immediately — it is only shown once

### Note the three values you need

```
AZURE_TENANT_ID=       # Azure AD → Overview → Tenant ID
AZURE_CLIENT_ID=       # App Registration → Overview → Application (client) ID
AZURE_CLIENT_SECRET=   # The secret value you just copied
```

---

## Step 2 — Wire up MSAL in the Backend

The `@azure/msal-node` package is already installed. Replace the manual token logic in `graph-calendar.service.ts`:

```typescript
import { ConfidentialClientApplication } from '@azure/msal-node';

private msalClient = new ConfidentialClientApplication({
  auth: {
    clientId: process.env.AZURE_CLIENT_ID!,
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
    clientSecret: process.env.AZURE_CLIENT_SECRET!,
  },
});

private async getAccessToken(): Promise<string> {
  const result = await this.msalClient.acquireTokenByClientCredentials({
    scopes: ['https://graph.microsoft.com/.default'],
  });
  if (!result?.accessToken) throw new Error('MSAL token acquisition failed');
  return result.accessToken;
}
```

MSAL handles token caching and refresh automatically — no more 1-hour manual tokens.

Remove `GRAPH_TEMP_TOKEN` from the environment and the admin token-swap UI (or keep it as a debug override).

---

## Step 3 — Map Rooms to Exchange Mailboxes

Each meeting room in Outlook has a **resource mailbox** with an email address (e.g. `balaton@company.hu`). Update each room in the admin dashboard with its `calendarEmail`.

Then update `graph-calendar.service.ts` to query room mailboxes directly instead of the token user's personal calendar:

```typescript
// GET /users/{email}/calendarView instead of /me/calendarView
const email = room.calendarEmail;
const endpoint = email
  ? `/users/${encodeURIComponent(email)}/calendarView`
  : `/me/calendarView`;
```

**How to find room mailbox emails:**
- Exchange Admin Center → **Recipients** → **Resources** → find the room → copy the email
- Or ask IT / the person who manages Exchange Online

---

## Step 4 — Restrict CORS

In `backend/src/main.ts`:

```typescript
app.enableCors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
});
```

Set `FRONTEND_URL` in the backend's environment to the production frontend URL.

---

## Step 5 — Admin Page Authentication (Azure SSO)

The admin page currently has no authentication. Add a route guard using MSAL browser (delegated flow — user signs in):

```typescript
// frontend/src/App.tsx — wrap AdminView with an auth guard
import { useMsal } from '@azure/msal-react';

const AdminGuard = () => {
  const { accounts } = useMsal();
  if (accounts.length === 0) return <LoginPage />;
  return <AdminView />;
};
```

Only specific users or a security group should have access. This is configured in the App Registration under **Enterprise applications** → **Users and groups** → **Add user/group**.

---

## Step 6 — Production Build & Deployment

### Option A — Azure Container Apps (recommended)

1. **Build images** and push to Azure Container Registry:
   ```bash
   az acr build --registry <registry-name> --image meetingroom-backend:latest ./backend
   az acr build --registry <registry-name> --image meetingroom-frontend:latest ./frontend \
     --build-arg VITE_API_URL=https://backend.<env>.azurecontainerapps.io
   ```

2. **Create Container Apps** in Azure:
   - Backend Container App: set env vars `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `USE_MOCK_DATA=false`
   - Frontend Container App: no env vars (baked in at build time)
   - Use **Azure Key Vault references** for the client secret instead of plain env vars

3. **Persistent storage** for `backend/data/`:
   - Mount an Azure Files share so `rooms.json` and `config.json` survive redeployments

4. **Custom domain** (optional):
   - `kiosk.company.hu` → frontend Container App
   - `kiosk-api.company.hu` → backend Container App

### Option B — On-Premise Server (Docker)

Use the production `docker-compose.prod.yml` (see IMPROVEMENTS.md) on a server that tablets can reach on the LAN. Store secrets in a `.env` file with restricted file permissions. Set up a systemd service or Portainer for automatic restarts.

---

## Step 7 — Tablet Provisioning

| Step | Detail |
|------|--------|
| Hardware | Any Android tablet (Chrome) or iPad (Safari) with a wall mount |
| Browser | Chrome recommended — supports Wake Lock API to keep screen on |
| Kiosk mode | Android: use **Fully Kiosk Browser** app — locks to one URL, restarts on crash, controls screen brightness |
| URL | `https://kiosk.company.hu/?room=MMH%20Balaton` — one URL per room |
| Setup | Visit the URL once, select the room on the SetupScreen — stored in localStorage |
| Network | Connect to a dedicated IoT/office VLAN with access to the backend |

---

## Phase 2 Checklist

```
Azure setup
  [ ] App Registration created
  [ ] Calendars.Read + Calendars.ReadWrite permissions granted (admin consent)
  [ ] Client secret noted and stored securely
  [ ] Room mailbox emails mapped in the admin dashboard

Backend
  [ ] MSAL client credentials flow implemented (replaces GRAPH_TEMP_TOKEN)
  [ ] Room queries use /users/{email}/calendarView
  [ ] CORS restricted to frontend origin
  [ ] Secrets stored in Azure Key Vault / secure env

Frontend
  [ ] Admin page protected with Azure SSO route guard
  [ ] VITE_API_URL set to production backend URL at build time

Infrastructure
  [ ] Production Docker images built and pushed
  [ ] Backend deployed with persistent storage for data/
  [ ] Frontend deployed and reachable at kiosk domain
  [ ] Custom domain + TLS configured

Tablets
  [ ] Hardware purchased and wall-mounted
  [ ] Kiosk browser app configured
  [ ] Each tablet URL set to correct room
  [ ] Network access to backend verified
  [ ] Wake Lock / screen-always-on confirmed working

Testing
  [ ] Booking via kiosk appears in Outlook calendar
  [ ] Status reflects meetings booked in Outlook by others
  [ ] Token refresh is automatic (no manual intervention after 1 hour)
  [ ] Admin page requires Azure login
  [ ] Screen dims after 3 minutes idle on physical tablet
```

---

## Estimated Effort

| Task | Effort |
|------|--------|
| Azure App Registration + admin consent | 1–2 hours (depends on IT access) |
| MSAL wiring in backend | 2–3 hours |
| Room mailbox mapping + Graph query fix | 2–3 hours + IT coordination |
| Admin SSO route guard | 3–4 hours |
| Production deployment (Container Apps) | 4–6 hours |
| Tablet provisioning (per tablet) | 30 minutes |
| **Total** | **~2–3 days** (plus IT coordination wait time) |

The biggest bottleneck is typically getting Azure AD admin consent and Exchange room mailbox access — start those conversations early.
