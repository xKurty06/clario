# Development Troubleshooting

## Start the app

Install dependencies as described in the README, then run:

```powershell
.\run-dev.ps1
```

The script starts the backend on `127.0.0.1:8766`, writes backend output to `backend/logs/dev-backend.log`, waits for the health check to pass, and then launches Tauri.

## Check backend health

Open this URL:

```text
http://127.0.0.1:8766/health
```

Expected response:

```json
{"status":"ok"}
```

The API routes remain under:

```text
http://127.0.0.1:8766/api/v1
```

## Local backend service is not reachable

If the frontend shows:

```text
The local backend service is not reachable. Please make sure the backend is running on 127.0.0.1:8766.
```

Check these items:

- Confirm port `8766` is not already occupied by another process.
 Visit `http://127.0.0.1:8766/health`.

## Start backend and frontend separately

Backend:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --host 127.0.0.1 --port 8766 --reload
```

Frontend:

```powershell
cd frontend
npm run dev
```

If port `1420` is already in use:

```powershell
npm run dev -- --host 127.0.0.1 --port 1421
```

## Why preset selection is required

The Comparison Builder is flexible, and presets only create a starting structure. Requiring a preset selection prevents the app from assuming a comparison mode the user did not choose. Users can select `Custom Comparison Builder` when they want a fully manual setup.
