# Base44 Dev Environment

## Stack
- Vite + React (JSX) frontend using `@base44/sdk` and `@base44/vite-plugin`.
- No local backend/database — the app talks to the Base44 cloud backend via the SDK client (`src/api/base44Client.js`).

## Run
```
docker compose -f docker-compose.base44.yml up -d
```
- Web entry point on host port **3000** (mapped to Vite's 5173).
- `node:22` base image, repo bind-mounted at `/app`; deps installed at startup via `npm install`; live reload via `vite dev`.
- `node_modules` persisted in a named volume so installs are fast on restart.

## Required environment (external credentials)
The app needs two values to load data from the Base44 backend (read in `src/lib/app-params.js`):
- `VITE_BASE44_APP_ID` — the Base44 app ID.
- `VITE_BASE44_BACKEND_URL` — the Base44 backend API base URL.

Without them the dev server still boots, but the app shows a "failed to load app" error when fetching public settings. Placeholders live in `.env.base44-defaults`; real values are delivered via `/run/base44/app.env` (platform-managed) and override the placeholders.

## Vite config
`vite.config.js` sets `server.host: true` and `allowedHosts: true` so the preview's external hostname is accepted.

## Verify
```
curl -sf -H "Host: external-preview.example.com" http://localhost:3000/
```
Should return the Vite-served `index.html` with `/src/main.jsx` (live source, not a prebuilt bundle).
