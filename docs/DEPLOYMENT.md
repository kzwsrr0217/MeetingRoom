# Deployment — server, network, and tablets

How the pieces sit together, what each side must configure, and how to provision
the wall tablets (Android and iPad). Podman today on an app-server VM; Kubernetes
later. Pairs with [GO_LIVE_TASKS.md](GO_LIVE_TASKS.md) (the sequential checklist).

---

## 1. Topology

```
                          Microsoft 365
                     (graph.microsoft.com,
                      login.microsoftonline.com)
                               ▲  HTTPS 443 (egress)
                               │
   ┌───────────────────────────────────────────────┐
   │  App-server VM (existing, internal network)    │
   │  Podman rootless                               │
   │   ┌───────────────┐      ┌────────────────┐    │
   │   │ frontend      │ /api │ backend        │    │
   │   │ nginx :80     │─────▶│ NestJS :3000   │    │
   │   │ (published    │ pod  │ (localhost only)│   │
   │   │  :8080)       │ net  └────────────────┘    │
   │   └──────▲────────┘                            │
   └──────────┼────────────────────────────────────┘
              │ HTTP(S) to the frontend port only
   ┌──────────┼───────────────┐     ┌───────────────────────────┐
   │  TEST: office/internal    │     │  PROD: IoT VLAN            │
   │  1 tablet, browser kiosk  │     │  wall tablets, MDM kiosk   │
   └───────────────────────────┘     └───────────────────────────┘
              (network team routes IoT VLAN → app server frontend port)
```

Key points:
- **Tablets only ever open one URL** in kiosk mode and talk **only to the frontend
  port**. The frontend nginx proxies `/api` to the backend over the internal
  container network, so the backend is **not exposed** on the VM's network
  (bound to `127.0.0.1`).
- Only the **server** needs outbound HTTPS to Microsoft 365 (live mode).
- **Test phase:** the VM is already on the internal network, so a tablet on the
  office/internal network can reach it immediately — no IoT VLAN needed yet.
- **Production phase:** tablets move to the **IoT VLAN**; the **network team** adds
  the route/firewall rule so that VLAN can reach the app server's frontend port.

## 2. Network flows (give this table to the network team)

| Phase | Source | Destination | Port | Purpose |
|-------|--------|-------------|------|---------|
| Test | test tablet (office net) | app-server VM | `FRONTEND_PORT` (8080) | load the panel |
| Prod | tablets (IoT VLAN) | app-server VM | `FRONTEND_PORT` (or 443 via proxy) | load the panel |
| Both | app-server VM | `graph.microsoft.com`, `login.microsoftonline.com` | 443 | live Graph (skip in mock mode) |
| Admin | admin workstation | app-server VM | `FRONTEND_PORT` `/admin` | manage rooms/tokens |

Tablets need **no internet access** and **no access to the backend port** — only
to the frontend port on the app server. Keep the IoT VLAN otherwise isolated.

## 3. App-server VM setup (Podman)

The VM already runs another app, so **avoid port clashes** and keep this stack
self-contained.

1. **Pick free host ports** in the root `.env` (only the frontend is published):
   ```env
   FRONTEND_PORT=8090     # e.g. if 8080 is taken by the existing app
   BACKEND_PORT=3001      # localhost-only; change if 3000 is taken
   USE_MOCK_DATA=false
   AZURE_TENANT_ID=... ; AZURE_CLIENT_ID=... ; AZURE_CLIENT_SECRET=...
   ADMIN_API_KEY=<strong-random>
   ```
2. **Run rootless**, as a dedicated service user (isolates it from the other app):
   ```bash
   podman compose -f docker-compose.prod.yml -f docker-compose.corpca.yml up -d
   ```
3. **Persistence:** `./backend/data` (rooms.json + config.json) is bind-mounted —
   back it up. Room changes and preset names survive restarts.
4. **Auto-start on boot** (unattended server) — generate a systemd user service:
   ```bash
   loginctl enable-linger <serviceuser>          # start user services at boot
   podman generate systemd --new --files --name meetingroom_frontend
   podman generate systemd --new --files --name meetingroom_backend
   # place the unit files in ~/.config/systemd/user/ and: systemctl --user enable --now <unit>
   ```
   (On newer Podman, Quadlet `.container` files are the preferred equivalent.)
5. **Corporate CA (Zscaler):** builds need the CA — see [PODMAN.md](PODMAN.md).
6. **TLS:** for production put the frontend behind the org's reverse proxy (or add
   certs) so tablets use `https://kiosk.company.hu`. HTTPS is required for the
   Wake Lock API and PWA install. For the internal test, plain HTTP on the LAN is fine.

## 4. Tablet provisioning

Same principle on every platform: **one tablet = one room URL, launched full-screen
in a locked kiosk, screen always on.** URL pattern (id-based):
`https://kiosk.company.hu/?room=<room-id>` (e.g. `?room=mmh-sed`; the id is shown on
the Admin room card).

### 4a. Quick test (no MDM) — do this for the first tablet

- **Android:** open the URL in Chrome → ⋮ → **Add to Home screen** (installs the PWA,
  full-screen). Launch from the icon. Settings → Display → **Screen timeout: max /
  never** (or keep it on charge; the app also requests a Wake Lock).
- **iPad:** open the URL in Safari → **Share → Add to Home Screen** (full-screen web
  app). To lock it to that one app for a demo: Settings → Accessibility → **Guided
  Access** on, open the web app, triple-click the side button to start. Settings →
  Display → **Auto-Lock: Never**.

### 4b. Android — managed rollout (Intune, Android Enterprise **dedicated devices / COSU**)

1. In Intune, enrol the tablets as **Android Enterprise → Corporate-owned dedicated
   devices** (QR/zero-touch). These are userless, kiosk-locked.
2. Create a **Device configuration → Kiosk** profile:
   - Kiosk mode: **Single app** (Managed Home Screen not needed for one URL) or
     **Multi-app** with just the browser.
   - App: **Microsoft Edge** or **Managed Home Screen** launching Edge/Chrome, or a
     dedicated kiosk-browser app (e.g. Fully Kiosk Browser) if you want auto-restart
     and screen-on control baked in.
   - Set the **start URL** to the room URL; enable **auto-launch on boot**.
   - Disable status bar, volume, and hardware keys where offered.
3. **Screen always on:** in the same profile set the device to stay awake while
   charging (wall tablets are powered), or use the kiosk browser's screensaver/keep-
   screen-on setting.
4. **Per-room URL:** assign each device (or device group) its own room URL via the
   profile. One profile per room, or a single profile with a per-device token.

> Non-Intune alternative for Android: **Fully Kiosk Browser** app — set the start
> URL, "keep screen on", auto-restart on crash, and remote admin. Fast for a small
> pilot without full MDM.

### 4c. iPad — managed rollout (Intune + Apple Business Manager)

1. Add the iPads to **Apple Business Manager**, assign to Intune (**Automated Device
   Enrollment / ADE**) → supervised, no user affinity.
2. Push a **Web Clip** for the room URL (Intune → iOS/iPadOS app → **Web link**), so
   it appears as a full-screen home-screen app.
3. Lock the iPad to that one app with **Single App Mode (Autonomous Single App Mode)**
   via an Intune **Device restrictions / Kiosk** profile → single app = the Web Clip
   (or Safari). This is the managed equivalent of Guided Access, applied over the air.
4. **Screen always on:** Intune device restriction → **Auto-Lock: Disabled** (or a
   configuration profile setting `maxInactivity`), and keep the iPad powered.
5. **Per-room URL:** one Web Clip/profile per room, assigned to that iPad's group.

> iOS/iPadOS supports the **Screen Wake Lock API** from **16.4+**, and PWAs added to
> the Home Screen run full-screen — so a supervised iPad in Single App Mode on the
> room's Web Clip behaves like a dedicated panel.

### Rollout checklist (per tablet)

```
[ ] Room exists in Admin UI with the correct calendarEmail (live mode)
[ ] Room mailbox is in the Application Access Policy group (live mode)
[ ] Tablet enrolled (Intune) or PWA installed (quick test)
[ ] Kiosk/Single-App mode locked to the room URL (?room=<id>)
[ ] Auto-launch on boot + auto-restart on crash
[ ] Screen never sleeps (powered + Wake Lock / Auto-Lock off)
[ ] Mounted; walked-up test: book / check-in / release / extend all work
[ ] (Prod) tablet moved to IoT VLAN; network team confirmed it reaches the frontend
```

## 5. Later: Kubernetes

The same two images move to K8s unchanged: a `Deployment` + `Service` each, an
`Ingress`/`Route` for TLS, a `ConfigMap` for non-secrets, a `Secret` for `AZURE_*`
and `ADMIN_API_KEY`, and a `PersistentVolumeClaim` for `backend/data`. Use
`/api/health` for liveness/readiness probes. Keep the frontend the only externally
exposed service; the backend stays a `ClusterIP`.
