# MeetingRoom — User Guide

## What is this?

The MeetingRoom kiosk is a tablet mounted outside each meeting room. It shows whether the room is currently free or occupied, displays today's meeting schedule, and lets you book the room on the spot.

---

## Reading the Screen

### Free Room

The screen shows a **green** status card with **"SZABAD"** (Free). You can see:
- When the next meeting starts (if any)
- Upcoming meetings for the next few hours in the strip above the timeline
- Today's full schedule on the green/red timeline bar at the bottom

### Occupied Room

The screen shows a **red** status card with **"FOGLALT"** (Occupied). You can see:
- The name of the current meeting
- Who organised it
- When the meeting ends, with a live countdown ("Még X perc")
- Upcoming meetings for the next few hours in the strip above the timeline

The status updates automatically every 10 seconds. A small green dot labelled **"Élő"** in the top-right corner confirms the kiosk is connected and live.

### Upcoming Meetings Strip

A compact row above the timeline always shows the next 1–4 meetings within the coming 5 hours:
- Time range (e.g. **10:00–11:30**)
- Meeting title
- Organiser

### Timeline Bar

The coloured bar at the very bottom shows today's schedule as 30-minute blocks:
- **Red** — the slot is booked
- **Green** — the slot is free (tap to book it in advance)
- The current time slot is highlighted with a yellow ring and "Most" label
- Past slots are greyed out

---

## Booking a Room

### Instant Booking (the room is free right now)

1. Tap **"Azonnali foglalás"** (Book now) on the green status card
2. A booking dialog opens:
   - **Meeting name** (optional) — type a title, e.g. "Design review"
   - **Duration** — choose 15, 30, or 60 minutes
   - **Your name** — pick from the list or tap "Más név..." to type
3. Tap **"Megerősítés"** (Confirm)
4. A confirmation message appears and the room status updates to occupied

> In live mode the booking is written directly to the meeting room's Outlook calendar. In demo (mock) mode it is simulated locally and resets when the server restarts.

### Booking in Advance (timeline booking)

1. Look at the **timeline** at the bottom — green blocks are free slots
2. Tap a free future slot
3. The same booking dialog opens, with the start time shown at the top
4. Enter a title (optional), choose duration and your name
5. Tap **"Megerősítés"**

The new event appears in the timeline and upcoming strip immediately.

---

## Checking In

If you are the organiser or attendee of the current meeting:

1. Tap **"Check-in"** on the red status card
2. A confirmation tick appears — your presence is recorded

> Currently check-in is logged for demonstration purposes. It does not modify the meeting in Outlook.

---

## Viewing Other Rooms

You can check the availability of other rooms from any kiosk:

1. Tap **"Tárgyalók Állapota"** (Room Status) in the top-right corner
2. A full-screen panel shows all rooms with their live status (free/occupied + end time)
3. Tap any room card to switch to that room's kiosk view

> A blue banner at the top warns you that you are viewing a different room.  
> The screen returns to this room's home view automatically after **60 seconds**, or tap **"Vissza"** (Back) immediately.

---

## Troubleshooting

| What you see | What it means | What to do |
|---|---|---|
| "Szinkronizálás..." spinning screen | Backend is starting up | Wait 10–30 seconds |
| "Kapcsolódási hiba" red error screen | Backend is unreachable | The screen retries automatically; contact IT if it persists |
| Token expiry error message | Microsoft Graph token has expired | Contact IT to refresh the token via the admin page |
| Room shows free but a meeting is in progress | Graph API token may have expired | Contact IT to refresh the token |
| Booking appears to succeed but no calendar event appears | Token expired or wrong calendar | Contact IT |
| Screen is showing the wrong room | Home room not set correctly | Long-press the clock (3 seconds) to reset and re-select the room |

---

## Contact

For technical issues contact your IT administrator. Please provide:
- Which kiosk / which room
- What you were trying to do
- What the screen showed
