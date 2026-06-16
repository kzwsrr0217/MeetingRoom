# MeetingRoom — Demo Plan

## Goal

Show stakeholders a working meeting room kiosk. The demo runs on mock data — no Azure access needed. The focus is on the user experience: seeing room status at a glance, booking instantly, and checking other rooms.

---

## Before the Demo

### 1. Start the environment

**Option A — Local machine (recommended for reliability)**

```bash
cd c:\Projects\MeetingRoom
docker compose up
```

Wait for both containers to be healthy (~2 minutes on first run). Verify:
- http://localhost:5173 — kiosk loads
- http://localhost:5173/admin — admin dashboard loads

**Option B — GitHub Codespace (show to remote colleagues)**

1. Open the GitHub repo → **Code** → **Codespaces** → **Create codespace on master**
2. In the Codespace, open two terminals:
   - `cd backend && npm run start:dev`
   - `cd frontend && npm run dev`
3. In the **Ports** panel: right-click port **5173** → **Port Visibility** → **Public**
4. Share the URL

### 2. Prepare the browser

- Open http://localhost:5173 (or the Codespace URL)
- On first visit you land on the **SetupScreen** — select a room
- Suggested rooms for the demo: **MMH Balaton** (always occupied with realistic meetings) and **MMH Tihany** (always free, good for booking demo)
- Open the URL in a second tab with `?room=MMH%20Tihany` for the free room demo

### 3. Optional: open on a tablet

- Connect the tablet to the same network as your laptop
- Find your laptop's LAN IP: `ipconfig` → IPv4 Address (e.g. `192.168.1.10`)
- Open `http://192.168.1.10:5173` on the tablet
- Tap fullscreen button (top-right) for the real kiosk experience

---

## Demo Script (~15 minutes)

### Part 1 — Overview (2 min)

> "This is what we want to mount outside every meeting room. It shows the current status and the day's schedule at a glance."

- Show **MMH Balaton** — red, occupied
- Point out: meeting title, organiser, countdown timer ("Még X perc")
- Point out: **Upcoming strip** above the timeline (next 1–4 meetings)
- Point out: **Timeline bar** at the bottom — today's full schedule, current slot highlighted in yellow

### Part 2 — Booking (5 min)

Switch to **MMH Tihany** tab (free room).

> "Booking is done directly on the tablet — no phone, no Outlook needed."

1. Tap **"Azonnali foglalás"**
2. Type a meeting title: "Design review"
3. Select 30 minutes
4. Pick a name from the list
5. Tap **"Megerősítés"**
6. Show the room flipping to red with the correct title and name displayed

> "The booking appears in Outlook in live mode. Here we're running with simulated data."

**Advance booking from the timeline:**

1. Tap a green future slot on the timeline
2. Show the booking modal with the pre-filled start time
3. Book it
4. Show it appearing in the upcoming strip and timeline

### Part 3 — Other rooms (3 min)

> "From any tablet you can check all rooms without walking around."

1. Tap **"Tárgyalók Állapota"** (top-right)
2. Show the grid with live free/occupied status per room
3. Tap another room card — show the kiosk switching to that room's view

### Part 4 — Admin dashboard (3 min)

> "The admin page lets IT configure rooms and manage the Microsoft Graph token."

Open http://localhost:5173/admin (or `?admin` on the same tab).

- Show the room list — add a new room, drag to reorder
- Show the **Microsoft Graph Token** section — explain this is where a live token goes
- Show the preset name list — editable for each location's team

### Part 5 — Reset / tablet setup (2 min)

> "Setting up a new tablet takes 10 seconds."

1. Long-press the clock in the top-left for 3 seconds
2. Show the SetupScreen
3. Select a room
4. Show the kiosk loading for that room

> "The selection is stored in the browser — power-cycle the tablet and it remembers."

---

## Key Points to Highlight

| Feature | Talking point |
|---------|--------------|
| Real-time updates | Status refreshes every 10 seconds automatically |
| No app install | Runs in any browser — Chrome on Android, Safari on iPad |
| Offline resilience | Shows last known status if network drops briefly |
| Screen dim | After 3 minutes idle the screen dims to save the display; tap to wake |
| Room switching | One device can show any room — useful during setup |
| Admin in browser | No SSH, no deployment — room management is point-and-click |
| Mock vs live | Identical UX; live mode just needs a Graph token |

---

## If Something Goes Wrong

| Problem | Quick fix |
|---------|-----------|
| Blank screen / connection error | `docker compose logs backend` — restart if needed |
| Room stuck on wrong state | Restart backend: `docker compose restart backend` |
| Forgot which tab is which room | Check the browser tab title — it shows the room name |
| Codespace preview URL not working | Port visibility must be set to **Public** (not Private) |
| Setup screen appeared unexpectedly | Long-press the clock to re-select a room |
