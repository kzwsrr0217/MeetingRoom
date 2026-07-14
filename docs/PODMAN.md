# Running MeetingRoom on Podman

Production-style deployment using the real container images (no dev servers).
Uses [`docker-compose.prod.yml`](../docker-compose.prod.yml).

## Prerequisites (Windows)

Podman on Windows needs a Linux backend (WSL2). Install once:

```powershell
wsl --install                       # reboot if prompted
winget install RedHat.Podman        # or: winget install RedHat.Podman-Desktop
pip install podman-compose          # needs Python; or use `podman compose`
podman machine init
podman machine start
```

Verify:

```powershell
podman --version
podman-compose --version
```

## Corporate TLS inspection (Zscaler etc.) — required on the MMH network

On a network that intercepts HTTPS (Zscaler), image pulls and `npm ci` fail with
`certificate signed by unknown authority` / `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`
because the Podman VM and the build containers don't trust the corporate root CA.
Two fixes are needed (both verified on 2026-07-14):

**1. Let the Podman VM pull images from Docker Hub** — add the corporate root CA
to the VM's trust store:

```powershell
# Export the Zscaler root CA(s) the machine already trusts
$out = "$env:TEMP\corp-ca.pem"
$sb = New-Object System.Text.StringBuilder
Get-ChildItem Cert:\LocalMachine\Root,Cert:\LocalMachine\CA |
  Where-Object { $_.Subject -match 'Zscaler' } | ForEach-Object {
    [void]$sb.AppendLine("-----BEGIN CERTIFICATE-----")
    [void]$sb.AppendLine([Convert]::ToBase64String($_.RawData,'InsertLineBreaks'))
    [void]$sb.AppendLine("-----END CERTIFICATE-----")
  }
Set-Content $out $sb.ToString() -Encoding ascii

Get-Content $out -Raw | podman machine ssh "sudo tee /etc/pki/ca-trust/source/anchors/corp.pem > /dev/null"
podman machine ssh "sudo update-ca-trust"
podman machine stop; podman machine start   # reload certs in the podman service
```

**2. Let `npm ci` inside the build containers trust the CA** — copy the same PEM
to `backend/corp-ca.pem` and `frontend/corp-ca.pem` (git-ignored) and build with
the corp-CA Dockerfiles:

```powershell
Copy-Item $out .\backend\corp-ca.pem
Copy-Item $out .\frontend\corp-ca.pem
podman build -f backend/Dockerfile.corpca            -t meetingroom-backend  ./backend
podman build -f frontend/Dockerfile.podman.corpca    -t meetingroom-frontend ./frontend
```

On a normal (non-inspected) network, skip this section and use the plain
`Dockerfile` / `Dockerfile.podman` via compose as below.

## Running without a compose provider

Podman 5 needs `docker-compose` or `podman-compose` on PATH for `podman compose`.
If neither is installed, run the two containers directly:

```powershell
podman network create meetingroom
podman run -d --name backend  --network meetingroom -e USE_MOCK_DATA=true -e PORT=3000 `
  -p 3000:3000 -v meetingroom_data:/app/data meetingroom-backend
podman run -d --name frontend --network meetingroom -p 8080:80 meetingroom-frontend
# Kiosk: http://localhost:8080   Admin: http://localhost:8080/admin
```

## Start (mock mode — no Azure needed, good for the first test)

```powershell
$env:USE_MOCK_DATA = "true"
podman-compose -f docker-compose.prod.yml up --build
```

- Kiosk UI:  http://localhost:8080
- Admin UI:  http://localhost:8080/admin
- Backend:   http://localhost:3000/api/health

The backend serves mock data; the frontend (nginx) proxies `/api` to the
backend container, so everything is same-origin (no CORS to configure).

## Start (live Graph mode)

Put secrets in a root `.env` (chmod 600, never commit):

```env
USE_MOCK_DATA=false
ADMIN_API_KEY=<a-strong-random-string>
# Either a manual POC token…
GRAPH_TEMP_TOKEN=eyJ0eXAiOiJKV1Qi...
# …or the Azure AD app (preferred — auto-refresh):
AZURE_TENANT_ID=...
AZURE_CLIENT_ID=...
AZURE_CLIENT_SECRET=...
```

```powershell
podman-compose -f docker-compose.prod.yml up --build -d
podman-compose -f docker-compose.prod.yml logs -f
```

## Common commands

```powershell
podman-compose -f docker-compose.prod.yml ps
podman-compose -f docker-compose.prod.yml restart backend
podman-compose -f docker-compose.prod.yml down
```

## Notes vs. the dev `docker-compose.yml`

| | dev (`docker-compose.yml`) | prod (`docker-compose.prod.yml`) |
|---|---|---|
| Backend | `npm run start:dev` (hot reload) | compiled `node dist/main` |
| Frontend | Vite dev server :5173 | nginx serving built SPA :8080 |
| API origin | `http://localhost:3000` (CORS) | same-origin `/api` proxy (no CORS) |
| Admin auth | none unless `ADMIN_API_KEY` set | set `ADMIN_API_KEY`, enter it in Admin → System |

## If admin actions return 401

The mutating endpoints are protected once `ADMIN_API_KEY` is set. Open the
Admin page → **System → Admin kulcs**, paste the same value, Save. It is stored
per-browser and sent as the `x-admin-key` header.
