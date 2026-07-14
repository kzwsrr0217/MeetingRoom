# IT Service Request — Azure AD App Registration (MeetingRoom Kiosk)

> Copy the section below into the ticketing system. It is deliberately scoped to
> the **minimum** access needed and pre-proposes the tenant-wide-access
> mitigation so Security has nothing left to object to.

---

**Subject:** Azure AD App Registration for an internal meeting-room display — restricted to named room mailboxes only

**Priority:** Normal

**Requested by:** [your name] — [team / cost centre]

**Sponsor / manager:** [manager name]

---

## Business justification

We are running an internal proof-of-concept for a **meeting-room availability
display**: small tablets mounted outside meeting rooms that show whether the
room is free or busy and allow an on-the-spot booking. The goal is to reduce
"ghost" bookings and double-bookings and to improve room utilisation. The
application reads and writes **only the calendars of our own meeting-room
resource mailboxes** — no personal mailboxes, no user data.

## What we are asking IT to create

A **single-tenant** Azure AD App Registration:

| Setting | Value |
|---|---|
| Name | `MeetingRoom-Kiosk` |
| Supported account types | Single tenant (this organisation only) |
| Redirect URI | None — this is a daemon/background service with **no interactive user sign-in** |
| Authentication | **Certificate preferred** over client secret (we can provide a CSR / public key); a 12–24 month secret is acceptable if that is your standard |

## Microsoft Graph permission requested

| Permission | Type | Purpose |
|---|---|---|
| `Calendars.ReadWrite` | Application | Read room free/busy and create bookings in the **room** mailboxes |

We understand this is an application permission that, by default, grants
tenant-wide mailbox access. **We do not want tenant-wide access**, and we are
explicitly requesting the scoping described next.

## Access restriction — we will enforce it ourselves in Exchange

We understand this application permission is tenant-wide by default and **we do
not want tenant-wide access**. **We (the requester) are an Exchange Online
administrator and will apply an [Application Access Policy] ourselves** to
restrict the app to **only** our six meeting-room resource mailboxes, via a
dedicated mail-enabled security group:

```powershell
New-ApplicationAccessPolicy `
  -AppId <application-client-id> `
  -PolicyScopeGroupId MeetingRoom-Kiosk-Rooms@company.com `
  -AccessRight RestrictAccess `
  -Description "MeetingRoom kiosk: room mailboxes only"
```

After that policy is in place the application **cannot** read or write any
mailbox outside that group, even though the Graph permission itself is
application-level. We will provide the `Test-ApplicationAccessPolicy` output as
evidence if required.

So there is **nothing to configure on the Exchange side on your part** — we own
the room mailboxes and the scoping.

## Our security commitments

- Scope enforced by us to the six room mailboxes — **no personal or user data**.
- Credential rotation owned by us; calendar reminder set before expiry.
- We prefer **certificate** auth; long term on Azure we intend to use a
  **Managed Identity** so there is no stored secret at all.
- Named application owner: [your name]; co-owner: [manager name].
- Runs initially on an internal, network-restricted host (Podman), later Azure
  Container Apps. Not internet-exposed during the POC.

## What we need back from you after approval

1. The **App Registration** created (single tenant, no redirect URI) with
   `Calendars.ReadWrite` (Application) added
2. **Admin consent** granted for that permission (this is the one step that
   needs Global Admin / Privileged Role Admin)
3. **Tenant ID**, **Application (client) ID**, and the client
   **secret value / certificate thumbprint** (delivered securely)

That's it — we handle the Exchange mailbox scoping and the app configuration
ourselves.

## What we are explicitly NOT asking for (to keep scope unambiguous)

- ❌ Tenant-wide calendar access
- ❌ `Mail.*`, `User.Read.All`, `Directory.*`, or any user-data permission
- ❌ Any redirect URI or interactive user sign-in
- ❌ Access to any mailbox outside the six named room resources

---

### Why this framing helps approval

The three things Security usually objects to on this kind of request are
(1) unbounded tenant-wide application access, (2) no named owner or rotation
plan, and (3) secrets over certificates. This request pre-empts all three:
the requester (an Exchange admin) **enforces the mailbox scoping themselves**,
names an owner and rotation plan, and prefers certificate auth. The ask left to
IT is therefore minimal — **create the app and grant admin consent** — with no
security decision left to debate.
