# Branding reference

Clario's product naming is centralized in these controlled locations:

1. `frontend/src/app/config.ts` for UI display and package names.
2. `backend/app/config/constants.py` for API metadata.
3. `frontend/package.json`, `backend/pyproject.toml`, and `desktop/tauri/Cargo.toml` for package identifiers.
4. `desktop/tauri/tauri.conf.json` for Windows product name, title, and reverse-domain identifier.
5. `.env.example` prefixes when configuration compatibility is intentionally updated.

Search for old product names after branding edits. Avoid renaming SQLite tables or configuration directories without a migration plan once users have persisted data.
