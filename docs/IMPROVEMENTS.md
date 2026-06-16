# MeetingRoom — Improvement Recommendations

Recommendations are grouped by priority. Items marked **[POC BLOCKER]** should be resolved before a stakeholder demo. Items marked **[PRE-PROD]** are required before production deployment.

---

## Critical — POC

### 1. [POC BLOCKER] Token expires every hour — manual process is fragile

**Problem:** `GRAPH_TEMP_TOKEN` in `.env` is a manually obtained 1-hour bearer token. When it expires, the frontend shows a specific error: "A Microsoft Graph token lejárt" with a link to /admin. The admin dashboard shows remaining minutes and allows hot-swap without restart.

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

**Problem:** The current `getRoomStatus` call uses `/me/calendarview` which reads the signed-in user's personal calendar — not the meeting room's calendar. Room availability is correct only if the signed-in user manages the room mailboxes.

**Fix:** Query the room's shared mailbox or room resource directly:
```
/users/{room-email}/calendarview?...
```

This requires knowing the email address of each room's Outlook resource mailbox (stored in `calendarEmail` on the `Room` object), and the token must have `Calendars.Read` permission on those mailboxes.

**For the POC:** Use the calendar owner's token, or use mock mode.

---

## Pre-Production

### 3. [PRE-PROD] Use production builds, not dev servers

**Problem:** `docker-compose.yml` runs `npm run start:dev` (NestJS) and `npm run dev` (Vite). Dev servers are slower, expose source maps, and are not designed for multiple concurrent tablet clients.

**Fix:** Create a `docker-compose.prod.yml` with proper multi-stage builds:

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

### 4. [PRE-PROD] Restrict CORS

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

### 5. [PRE-PROD] Add Docker health checks

**Problem:** `docker compose ps` shows containers as "running" even if the app inside has crashed. The `depends_on: backend` in `docker-compose.yml` only waits for the container to start, not for the backend to be ready.

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

---

### 6. [PRE-PROD] Add a `.env.example` file

Document all required environment variables:

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

### 7. [PRE-PROD] Map room names to Exchange room mailboxes

**Problem:** Room IDs like `"MMH Séd"` are UI labels — they don't correspond to actual Outlook room resource mailboxes. All rooms currently read from the same calendar (the token user's personal calendar).

**Fix:** Use the `calendarEmail` field already on the `Room` model in `graph-calendar.service.ts`:

```typescript
// If the room has a calendarEmail configured, query that mailbox directly
const email = room?.calendarEmail;
const endpoint = email
  ? `/users/${email}/calendarview?...`
  : `/me/calendarview?...`;
```

---

### 8. [PRE-PROD] Admin page authentication

**Problem:** The admin dashboard at `/admin` has no authentication. In the POC this is intentional for simplicity, but it must be secured before exposing beyond the local network.

**Planned fix:** When deployed on Azure, implement SSO via Azure AD so only selected users can access `/admin`. The frontend already has a routing separation (`/admin` vs. `/`) that makes this easy to add as a route guard.

---

## Kubernetes / OpenShift

Before deploying to Kubernetes, complete all [PRE-PROD] items above, then:

1. **Create production Docker images** and push to a container registry
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
| Meeting extension button | Extend current meeting by 15/30 min from the kiosk |
| Cancellation button | Cancel a booking directly from the kiosk |
| Screen saver / idle mode | Blank screen after inactivity to save tablet display |
| E-ink / low-power display support | Static HTML alternative for e-ink tablets outside rooms |
| Automated token refresh status page | Admin dashboard showing token expiry countdown with auto-alert |
