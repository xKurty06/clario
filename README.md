# Procurement Validator

Temporary project name for a working local-first Windows application that compares flexible procurement spreadsheets.

## Version 1 status

- React 19 + TypeScript + Vite frontend with Tailwind CSS 4
- Tauri 2 desktop shell with a minimal capability set and content security policy
- FastAPI backend bound to loopback by default
- Centralized display/package naming
- Connected upload, mapping, preview, validation, template, and report pages
- Comparison Builder workflow with flexible data sources, row selection, custom fields, and rule-based validation
- `.xlsx`, `.xls`, and `.csv` extraction
- Strict description, quantity, unit-cost, total-cost, duplicate, missing, and extra-item checks
- SQLite template persistence and local PDF reports
- Base contracts for validators, extractors, report generators, and optional AI providers
- Layered services, repositories, validators, extractors, and report adapters
- Health endpoint and backend unit tests
- Architecture and extension documentation

## Windows prerequisites

- Windows 10 or 11 with Microsoft Edge WebView2
- [Node.js 20 or 22 LTS](https://nodejs.org/)
- Python 3.12 (recommended)
- Rust stable with the MSVC toolchain
- Microsoft C++ Build Tools with the Desktop development with C++ workload

The current machine may run newer tool versions, but the project targets the versions above for repeatable Windows development.

## Install dependencies

```powershell
cd frontend
npm install

cd ..\backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Copy `.env.example` to `.env` only when overriding local defaults. Never commit `.env`.

## Run the frontend

```powershell
cd frontend
npm run dev
```

Open `http://127.0.0.1:1420` for browser-based UI development.

## Run the backend

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --host 127.0.0.1 --port 8765 --reload
```

Health check: `http://127.0.0.1:8765/health`.

## Run the desktop UI (recommended)

From the project root:

```powershell
.\run-dev.ps1
```

This starts the loopback backend, opens the Tauri window, and stops the backend when the desktop process exits.

## Run Tauri development mode manually

Start the backend in one terminal, then:

```powershell
cd desktop\tauri
..\..\frontend\node_modules\.bin\tauri.cmd dev
```

Keeping the Python process separate in development makes backend errors visible in its terminal.

## Build for Windows

The frontend and Rust shell can be checked now:

```powershell
cd frontend
npm run build
cd ..\desktop\tauri
..\..\frontend\node_modules\.bin\tauri.cmd build
```

`bundle.active` remains `false`: creating a redistributable installer requires freezing and signing the Python backend as a sidecar. Development and local use are supported now.

## Tests

```powershell
cd backend
pytest

cd ..\frontend
npm run typecheck
npm run build
```

## Intended application workflow

1. Select local `.xlsx`, `.xls`, or `.csv` files.
2. Create one or more data sources from those files and sheets.
3. Review and adjust selected rows.
4. Add custom fields and comparison rules.
5. Run transparent backend validation.
6. Review discrepancies and export a local PDF report.

None of the core workflows require login, cloud storage, or internet access. Version 1 will not modify source files.

## Templates

Templates describe file roles, sheet selection, header/data row behavior, column mappings, lot rules, and ignored-row markers. They are stored locally in SQLite. See [Template design](docs/templates.md).

## Version 1 scope

Version 1 supports flexible upload/mapping, reusable templates, extracted-row preview, strict description matching, quantity/unit-cost/total checks, discrepancy review, and PDF export. Fuzzy matching, corrected copies, and local AI assistance remain optional future extensions.

AI will never be the source of truth. The reserved provider interface is advisory and the application works with the disabled provider.

## Architecture

- [Architecture overview](docs/architecture.md)
- [Extension guide](docs/extending.md)
- [Flexible Comparison Builder](docs/flexible-comparison-builder.md)
- [Template design](docs/templates.md)
- [Rename guide](docs/renaming.md)
- [Phase roadmap](docs/roadmap.md)

## Temporary app name

The primary naming constants are in `frontend/src/app/config.ts` and `backend/app/config/constants.py`. Tauri metadata must also contain the user-visible name because Windows packaging consumes static configuration; follow the rename guide to update these few controlled locations.
