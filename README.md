# MeetingRoom

A tablet/kiosk application for displaying real-time meeting room availability and enabling instant bookings via Microsoft Outlook.

## Quick Start (Docker Desktop)

```bash
docker compose up
```

- **Frontend (kiosk UI):** http://localhost:5173
- **Backend API:** http://localhost:3000/api

> **First start:** takes 2–4 minutes for npm install. Subsequent starts are fast.

## Default Mode

The app defaults to **live Microsoft Graph mode** (`USE_MOCK_DATA=false`). To run without Azure credentials, switch to mock mode in `backend/.env`:

```env
USE_MOCK_DATA=true
```

See [Admin Guide](docs/ADMIN_GUIDE.md) for token management.

## Documentation

| Guide | Audience |
|-------|----------|
| [Developer Guide](docs/DEVELOPER_GUIDE.md) | Developers — setup, architecture, API reference |
| [Admin Guide](docs/ADMIN_GUIDE.md) | Admins — deployment, token management, future environments |
| [User Guide](docs/USER_GUIDE.md) | End users — how to use the kiosk |
| [Podman Guide](docs/PODMAN.md) | Running the production stack on Podman (incl. Zscaler/corporate TLS) |
| [Recommendations](docs/RECOMMENDATIONS.md) | Product/UX review — test-readiness, pre-prod, feature parity |
| [App Registration Request](docs/APP_REGISTRATION_REQUEST.md) | Ready-to-send IT ticket for the Azure AD app |
| [Go-Live Tasks](docs/GO_LIVE_TASKS.md) | Who does what: Exchange/Entra/Intune self-service vs. IT/network |
| [Deployment & Tablets](docs/DEPLOYMENT.md) | Server VM/Podman, network topology (test + IoT VLAN), Android/iPad kiosk setup |
| [Improvements](docs/IMPROVEMENTS.md) | Recommended changes for POC and production |

## Tech Stack

- **Backend:** NestJS 11 + TypeScript + Microsoft Graph API
- **Frontend:** React 19 + Vite + Tailwind CSS
- **Containerization:** Docker Compose (`node:20-alpine`)
- **Auth:** Microsoft MSAL (currently using 1-hour manual tokens for POC)
