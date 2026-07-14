# Go-Live Tasks — who does what

The requester is an **Exchange Online, Entra, and Intune administrator**, so most
of the go-live work is self-service. Only two things need other teams: the
**app registration + admin consent** (Global IT / Global Admin) and the
**network/edge** tasks.

| Area | Owner | Task |
|---|---|---|
| App registration + admin consent | **Global IT** | Create single-tenant app, add `Calendars.ReadWrite` (Application), grant admin consent. See [APP_REGISTRATION_REQUEST.md](APP_REGISTRATION_REQUEST.md). |
| Room mailboxes + calendar processing | **You (Exchange)** | Ensure room resource mailboxes exist and auto-accept bookings. |
| Least-privilege scoping | **You (Exchange)** | Application Access Policy restricting the app to the room mailboxes. |
| App wiring | **You** | Put `AZURE_*` in `.env`, set each room's `calendarEmail`, verify. |
| Tablet kiosk rollout | **You (Intune)** | Enrol tablets, kiosk profile, per-room URL. |
| DNS, TLS, firewall, VLAN | **Network team** | Publish the app securely; allow tablet↔backend and backend↔Graph. |

> **Worth checking first:** if your Entra role is **Application Administrator** or
> **Cloud Application Administrator**, you may be able to *create* the app
> registration yourself — but **granting admin consent** for a Graph *application*
> permission still needs **Global Administrator** (or Privileged Role Admin). So
> the consent step almost certainly still goes to Global IT.

---

## First test with ONE tablet — step by step

The meeting rooms already exist and are booked from Outlook/Teams. This walkthrough
takes you from "app registration is ready" to a working panel on one wall-mounted
tablet for a single test room (e.g. **MMH Séd** → mailbox `sed@company.com`). Do
the backend/Graph checks **before** you touch a tablet — most problems surface there.

**Prerequisites:** app registration done; you have `AZURE_TENANT_ID`,
`AZURE_CLIENT_ID`, and the client secret (or certificate). Pick one test room and
note its resource-mailbox email.

### Step 1 — Exchange: scope the app to the test room (you)
```powershell
Connect-ExchangeOnline
# Rooms are already AutoAccept if people book them from Outlook; confirm:
Get-CalendarProcessing -Identity sed@company.com | Select AutomateProcessing

# Restrict the app to just this room to start (add more rooms later)
New-DistributionGroup -Name "MeetingRoom-Kiosk-Rooms" -Type Security `
  -PrimarySmtpAddress meetingroom-kiosk-rooms@company.com
Add-DistributionGroupMember -Identity meetingroom-kiosk-rooms@company.com -Member sed@company.com

New-ApplicationAccessPolicy -AppId <CLIENT_ID> `
  -PolicyScopeGroupId meetingroom-kiosk-rooms@company.com `
  -AccessRight RestrictAccess -Description "MeetingRoom kiosk: room mailboxes only"

Test-ApplicationAccessPolicy -Identity sed@company.com -AppId <CLIENT_ID>   # -> Granted
```
> The policy can take up to ~30 minutes to take effect.

### Step 2 — Backend: switch to live mode (you)
Put the credentials in the root `.env` (git-ignored) and turn off mock:
```env
USE_MOCK_DATA=false
AZURE_TENANT_ID=...
AZURE_CLIENT_ID=...
AZURE_CLIENT_SECRET=...
ADMIN_API_KEY=<strong-random>
```
```powershell
podman compose -f docker-compose.prod.yml -f docker-compose.corpca.yml up -d --force-recreate
# Expect: {"status":"ok","mode":"graph","auth":"msal"}
Invoke-RestMethod http://localhost:8080/api/health
```

### Step 3 — Map the test room in the Admin UI (you)
1. Open `http://<host>:8080/admin` (enter the `ADMIN_API_KEY` under **System → Admin kulcs**).
2. On the **MMH Séd** card click ✎ and set **calendarEmail = `sed@company.com`**, save.
   (This is what makes the backend read `/users/sed@company.com/calendarView`
   instead of the token user's own calendar.)

### Step 4 — Prove both directions BEFORE mounting a tablet (you)
- **Outlook → panel:** from Outlook/Teams, book MMH Séd for "now". Within ~15 s the
  Admin grid (and `GET /api/calendar/room/mmh-sed/status`) shows it **occupied** with
  the real title/organiser.
- **Panel → Outlook:** open `http://<host>:8080/?room=mmh-sed` in a browser and book
  30 min → the event appears in the room's Outlook calendar.

If both work, live Graph is correct — the tablet is now just a display.

### Step 5 — Set up the test tablet (quick manual path)
For a first test you don't need Intune yet:
1. On the tablet open Chrome/Edge → `https://kiosk.company.hu/?room=mmh-sed`
   (or `http://<host-ip>:8080/?room=mmh-sed` on the LAN).
2. Launch full-screen / kiosk:
   - Android: Chrome menu → **Add to Home screen** (PWA), open from the icon; or use
     a kiosk-browser app.
   - Windows: `msedge --kiosk https://kiosk.company.hu/?room=mmh-sed --edge-kiosk-type=fullscreen`
3. Mount the tablet on the wall and confirm the screen stays on (Wake Lock; disable
   sleep in the tablet's display settings).

> First run also offers a room picker (SetupScreen) if you open the base URL without
> `?room=`; selecting the room stores it in that tablet's `localStorage`.

### Step 6 — Real-world test at the wall
Walk up to the panel and check: book 30 min (appears in Outlook), **Check-in**,
**+15 perc**, **Vége/Elengedés**, and that a booking made from Teams shows up on the
panel. Once happy, roll the tablet out via **Intune** (section 3) and repeat per room.

---

## 1. Exchange (you) — room mailboxes, scoping, calendar behaviour

```powershell
Connect-ExchangeOnline

# (a) Confirm the six room resource mailboxes exist (create any that don't)
Get-Mailbox -RecipientTypeDetails RoomMailbox | Select DisplayName, PrimarySmtpAddress
# New-Mailbox -Room -Name "MMH Séd" -PrimarySmtpAddress sed@company.com   # if needed

# (b) Auto-accept bookings and keep the subject/organiser readable on the panel
$rooms = "sed@company.com","balaton@company.com","mars@company.com",
         "tihany@company.com","bakony@company.com","kis-balaton@company.com"
foreach ($r in $rooms) {
  Set-CalendarProcessing -Identity $r -AutomateProcessing AutoAccept `
    -AddOrganizerToSubject $true -DeleteComments $false -DeleteSubject $false `
    -RemovePrivateProperty $false -AllowConflicts $false
}

# (c) Least-privilege scoping — restrict the app to ONLY these mailboxes
New-DistributionGroup -Name "MeetingRoom-Kiosk-Rooms" -Type Security `
  -PrimarySmtpAddress meetingroom-kiosk-rooms@company.com
foreach ($r in $rooms) { Add-DistributionGroupMember -Identity meetingroom-kiosk-rooms@company.com -Member $r }

New-ApplicationAccessPolicy -AppId <CLIENT_ID> `
  -PolicyScopeGroupId meetingroom-kiosk-rooms@company.com `
  -AccessRight RestrictAccess -Description "MeetingRoom kiosk: room mailboxes only"

# (d) Prove the scoping (do this after the app exists)
Test-ApplicationAccessPolicy -Identity sed@company.com     -AppId <CLIENT_ID>   # AccessCheckResult: Granted
Test-ApplicationAccessPolicy -Identity someuser@company.com -AppId <CLIENT_ID>  # AccessCheckResult: Denied
```

> Application Access Policy changes can take up to ~30 minutes to propagate.

## 2. App wiring (you)

Once IT returns the Tenant ID / Client ID / secret (or certificate):

1. Put them in the root `.env` (git-ignored) and switch off mock mode:
   ```env
   USE_MOCK_DATA=false
   AZURE_TENANT_ID=...
   AZURE_CLIENT_ID=...
   AZURE_CLIENT_SECRET=...
   ADMIN_API_KEY=<strong-random>
   ```
2. Restart: `podman compose -f docker-compose.prod.yml -f docker-compose.corpca.yml up -d --force-recreate`
3. Verify `GET /api/health` → `"auth":"msal"`.
4. In **Admin → Tárgyalók kezelése**, set each room's `calendarEmail` to its
   resource-mailbox address (this is what makes the backend query
   `/users/{email}/calendarView` instead of `/me`).
5. Smoke test: book from a kiosk → the event appears in the room's Outlook
   calendar; a meeting booked in Outlook shows on the kiosk within ~15 s.

## 3. Intune (you) — tablet kiosk rollout

Per room, one device assigned one URL (`https://kiosk.company.hu/?room=mmh-<room>`):

- **Android Enterprise (dedicated devices / COSU)** — enrol as a dedicated
  device; use a **Device restrictions → Kiosk (multi/single-app)** profile
  pinned to Chrome/Edge (or Managed Home Screen) launching the room URL. Disable
  status bar, volume, and power where possible; keep the screen on.
- **Windows** — **Assigned Access** kiosk profile running Edge in kiosk mode at
  the room URL; set power plan to never sleep the display.
- Assign each device its room URL via a per-device group or a configuration
  policy variable. The PWA `manifest.json` also allows "Add to Home Screen".

## 4. Network team (not you)

> Full topology, port table, server VM/Podman setup, and Android/iPad kiosk
> provisioning are in **[DEPLOYMENT.md](DEPLOYMENT.md)**.

Provide these so tablets and the backend can talk securely:

- **DNS**: e.g. `kiosk.company.hu` → frontend, `kiosk-api.company.hu` → backend
  (or one host with the nginx `/api` proxy).
- **TLS**: certificate + HTTPS termination (Wake Lock and PWA install require a
  secure context).
- **Firewall / VLAN**:
  - tablets → backend/frontend host (HTTP/HTTPS)
  - backend host → `graph.microsoft.com` and `login.microsoftonline.com` (443)
  - optionally a dedicated IoT/office VLAN for the tablets
- If Zscaler inspects the backend host's egress, ensure the container trust store
  includes the corporate CA (see [PODMAN.md](PODMAN.md)).

---

## Adding or removing rooms later (extensibility)

The room list is not hard-coded — it lives in `backend/data/rooms.json` and is
managed from the Admin UI, so you can grow the fleet anytime **without a redeploy**.
To add a room:

1. **Admin UI → Tárgyalók kezelése → Új tárgyaló:** enter the name and the room's
   **calendarEmail** (its Outlook resource mailbox). It appears on all kiosks and in
   the setup picker within ~5 minutes.
2. **Exchange (don't skip):** add the new room's mailbox to the access-policy group,
   or the app gets **403** for it:
   ```powershell
   Add-DistributionGroupMember -Identity meetingroom-kiosk-rooms@company.com -Member jupiter@company.com
   Test-ApplicationAccessPolicy -Identity jupiter@company.com -AppId <CLIENT_ID>   # -> Granted
   ```
3. **Provision a tablet** for it with `?room=<new-id>` (the id is the slug shown in
   the Admin card / kiosk link, e.g. `mmh-jupiter`), via Intune or the manual path.

To **remove** a room: delete it in the Admin UI and remove its mailbox from the
group. Existing bookings stay in Outlook — only the panel/app stops showing it.

> **Common gotcha:** a newly added room shows "Kapcsolódási hiba" or stays empty in
> live mode almost always because step 2 was missed — the mailbox isn't in the
> Application Access Policy group yet.
