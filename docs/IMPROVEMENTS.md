# MeetingRoom — Improvement Recommendations

Recommendations are grouped by priority. Items marked **[POC BLOCKER]** should be resolved before a stakeholder demo. Items marked **[PRE-PROD]** are required before production deployment.

---

## Critical — POC

### 1. [POC BLOCKER] Token expires every hour — manual process is fragile

**Problem:** `TEMP_TOKEN` in `graph-calendar.service.ts` is a hardcoded 1-hour bearer token. When it expires, the app silently stops showing real calendar data and shows a connection error.

**Immediate fix (POC):** Set `USE_MOCK_DATA=true` for demos where token refresh isn't practical. The mock data is visually identical to live data.

**Proper fix (after Azure AD access):** Implement MSAL client credentials flow. The library is already installed:

```typescript
// backend/src/calendar/graph-calendar.service.ts
import { ConfidentialClientApplication } from '@azure/msal-node';

const msalClient = new ConfidentialClientApplication({
  auth: {
    clientId: process.env.AZURE_CLIENT_ID!,
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
    clientSecret: process.env.AZURE_CLIENT_SECRET!,
  },
});

// In the auth provider:
const result = await msalClient.acquireTokenByClientCredentials({
  scopes: ['https://graph.microsoft.com/.default'],
});
// result.accessToken is auto-refreshed by MSAL
```

This requires the Azure AD app registration to have **application permissions** (not delegated) for `Calendars.Read` and `Calendars.ReadWrite` on the target mailboxes.

---

### 2. [POC BLOCKER] Graph API reads from the token user's personal calendar

**Problem:** The current `getRoomStatus` call uses `/me/calendarview` which reads the signed-in user's personal calendar — not the meeting room's calendar. Room availability is correct only if the signed-in user is the one who manages the room mailboxes.

**Fix:** Query the room's shared mailbox or room resource directly:
```
/users/{room-email}/calendarview?...
```

This requires knowing the email address of each room's Outlook resource mailbox, and the token must have `Calendars.Read` permission on those mailboxes.

**For the POC:** Document which Outlook account's calendar is being displayed, and use the calendar owner's token. Or use mock mode.

---

### 3. [POC NICE-TO-HAVE] Add a visible token expiry warning

**Problem:** When the token expires, the user sees a generic "connection error" in Hungarian with no indication of what happened or when it will be fixed.

**Quick fix in `graph-calendar.service.ts`:** Log a clear warning with timestamp when a Graph API call fails with 401:
```typescript
if (error.statusCode === 401) {
  console.error(`[TOKEN EXPIRED] ${new Date().toISOString()} — Replace TEMP_TOKEN and restart backend.`);
}
```

**Better fix:** Add an `/api/health` endpoint that returns token status, and show a small indicator in the frontend header when the backend is in degraded state.

---

## Pre-Production

### 4. [PRE-PROD] Frontend API URL is hardcoded

**Problem:** `frontend/src/hooks/useRoomStatus.ts` has:
```typescript
const API_BASE = 'http://localhost:3000/api';
```

The `VITE_API_URL` environment variable set in `docker-compose.yml` is never read. This works on Docker Desktop (all ports are on localhost) but will break in any other environment.

**Fix:**
```typescript
// frontend/src/hooks/useRoomStatus.ts
const API_BASE = `${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api`;
```

After this change, you can configure the backend URL at deploy time without changing source code.

---

### 5. [PRE-PROD] Use production builds, not dev servers

**Problem:** `docker-compose.yml` runs `npm run start:dev` (NestJS) and `npm run dev` (Vite). Dev servers:
- Are slower
- Expose source maps (leaks code)
- Not designed for production workloads
- Vite dev server is not designed to serve multiple concurrent tablet clients

**Fix:** Create a separate `docker-compose.prod.yml` with proper build stages:

```dockerfile
# backend/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/main"]
```

```dockerfile
# frontend/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
```

---

### 6. [PRE-PROD] Restrict CORS

**Problem:** `backend/src/main.ts` enables CORS for all origins:
```typescript
app.enableCors(); // Allows any origin
```

**Fix:** Restrict to the frontend's origin:
```typescript
app.enableCors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
});
```

---

### 7. [PRE-PROD] Add Docker health checks

**Problem:** `docker compose ps` shows containers as "running" even if the application inside has crashed or the backend is still starting up. The frontend `depends_on: backend` doesn't wait for the backend to be ready — just for the container to start.

**Fix in `docker-compose.yml`:**
```yaml
services:
  backend:
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/health"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

  frontend:
    depends_on:
      backend:
        condition: service_healthy
```

Also add a `/api/health` endpoint to the backend:
```typescript
@Get('health')
health() {
  return { status: 'ok', timestamp: new Date().toISOString() };
}
```

---

### 8. [PRE-PROD] Add a `.env.example` file

Document all required environment variables so new developers know what to configure:

```env
# backend/.env.example
USE_MOCK_DATA=false
PORT=3000
AZURE_TENANT_ID=your-tenant-id-here
AZURE_CLIENT_ID=your-client-id-here
AZURE_CLIENT_SECRET=your-client-secret-here
```

Commit `.env.example` to git; `.env` stays in `.gitignore`.

---

### 9. [PRE-PROD] Map room names to Exchange room mailboxes

**Problem:** Room IDs like `"MMH Séd"` are UI labels — they don't correspond to actual Outlook room resource mailboxes. All rooms currently read from the same calendar (the token user's).

**Fix:** Create a room mapping in backend configuration:
```typescript
const ROOM_MAILBOXES: Record<string, string> = {
  'MMH Séd': 'sed.terem@company.com',
  'MMH Balaton': 'balaton.terem@company.com',
  // ...
};
```

Then in `graph-calendar.service.ts`, query the correct mailbox:
```typescript
const email = ROOM_MAILBOXES[roomId];
const endpoint = email ? `/users/${email}/calendarview` : `/me/calendarview`;
```

---

## Kubernetes / OpenShift

Before deploying to Kubernetes, complete all [PRE-PROD] items above, then:

1. **Create production Docker images** (item 5 above) and push to a container registry
2. **Create Kubernetes manifests:**
   - `Deployment` for backend (1+ replicas)
   - `Deployment` for frontend (nginx, 1+ replicas)
   - `Service` for each deployment
   - `Ingress` for external access (or OpenShift `Route`)
   - `ConfigMap` for non-secret environment variables
   - `Secret` for Azure AD credentials
3. **Configure liveness and readiness probes** using the `/api/health` endpoint
4. **Use Azure Key Vault / OpenShift Secrets** for credentials instead of `.env` files

---

## Azure (Future)

Recommended architecture for Azure:

| Component | Azure Service |
|-----------|---------------|
| Backend | Azure Container Apps |
| Frontend | Azure Static Web Apps |
| Secrets | Azure Key Vault |
| Auth | Managed Identity (eliminates client secret) |
| Registry | Azure Container Registry |

With Managed Identity, the backend can call Microsoft Graph without any stored credentials — the Azure platform handles authentication transparently.

---

## Nice-to-Have (Post-POC)

| Item | Benefit |
|------|---------|
| Internationalization (i18n) | Allow English UI for non-Hungarian users |
| Audit log (database) | Track who booked what and when |
| Meeting extension button | Extend current meeting by 15/30 min |
| Cancellation button | Cancel a booking directly from the kiosk |
| Screen saver / idle mode | Blank screen after inactivity to save tablet display |
| Multi-language organizer name | Currently fallback is "Nagy Anna (Design Team)" hardcoded in hook |
| E-ink / low-power display support | Static HTML alternative for e-ink tablets outside rooms |
| Automated token refresh status page | Admin dashboard showing token expiry countdown |
