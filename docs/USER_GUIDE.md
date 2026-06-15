# MeetingRoom — User Guide

## What is this?

The MeetingRoom kiosk is a tablet mounted outside (or inside) each meeting room. It shows whether the room is currently free or occupied, displays today's meeting schedule, and lets you book the room on the spot.

---

## Reading the Screen

### Free Room

The screen shows a **green** status card with "SZABAD" (Free). You can see:
- When the next meeting starts (if any)
- Today's schedule on the timeline at the bottom

### Occupied Room

The screen shows a **red** status card with "FOGLALT" (Occupied). You can see:
- The name of the current meeting
- Who organized it
- When the meeting ends

The status updates automatically every 10 seconds.

---

## Booking a Room

### Instant Booking (the room is free right now)

1. Tap the **"Foglalom most"** (Book now) button
2. The room is booked for **15 minutes** in your Outlook calendar
3. The status immediately changes to "Occupied"

> **Note:** Bookings appear in the calendar under the name shown on the kiosk. Contact IT if the name is wrong.

### Booking in Advance (timeline booking)

1. Look at the **timeline** at the bottom of the screen — it shows today's schedule as blocks
2. Tap an empty (free) time slot on the timeline
3. A booking dialog appears — choose duration: **15, 30, or 60 minutes**
4. Confirm the booking

The new event appears in the timeline immediately.

---

## Checking In

If you are the attendee of the current meeting:
1. Tap **"Bejelentkezés"** (Check-in)
2. Your presence is confirmed

> Currently this is a demonstration feature — check-in is logged but does not change the meeting status.

---

## Viewing Other Rooms

You can browse the availability of other rooms from any kiosk:

1. Tap the **room name** in the header (top of the screen)
2. A list of all available rooms appears
3. Tap any room to see its current status

> A blue banner at the top warns you that you are viewing a different room.  
> The screen returns to the home room automatically after **60 seconds**, or tap **"Vissza az alapértelmezetthez"** (Back to default) to return immediately.

---

## Weekly View

Tap the **"Heti nézet"** (Weekly view) button to see the full week's schedule for the current room.

---

## Troubleshooting

| What you see | What it means | What to do |
|---|---|---|
| "Szinkronizálás..." spinning screen | Backend is starting up | Wait 10–30 seconds |
| "Nem sikerült kapcsolódni a szerverhez" | Backend is unreachable | Contact IT |
| "Hiba" red error screen | API error | Note the message and contact IT |
| Room shows free but a meeting is in progress | Graph API token may have expired | Contact IT to refresh the token |
| Booking appears to succeed but no calendar event appears | Token expired or wrong calendar | Contact IT |

---

## Contact

For technical issues, contact your IT administrator. Provide:
- Which kiosk / which room
- What you were trying to do
- What the screen displayed
