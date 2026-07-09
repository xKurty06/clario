# Architecture

## Desktop and frontend

Tauri hosts a Vite-built React single-page application. Pages compose reusable components; feature logic belongs under `frontend/src/features`, network calls under `services`, and cross-page types under `types`. Core validation must never run in React.

Tauri starts with only `core:default` permissions. The content security policy permits the packaged UI and the loopback backend. File-system or dialog permissions should be added only when a concrete workflow requires them.

## Backend

FastAPI is the local transport boundary. Routes validate/translate HTTP data and delegate to services. Services orchestrate use cases, validators own one rule each, extractors own input formats, and repositories are the only modules that access SQLite.

The intended validation pipeline is:

```text
safe file intake -> sheet detection -> template application -> row extraction
-> conservative normalization -> user preview -> comparison context
-> validator list -> immutable validation result -> report preparation -> output adapter
```

Report generators consume a completed result and cannot trigger validation. AI providers are optional advisory adapters and cannot mutate results.

## Local data and trust boundaries

- The API binds only to `127.0.0.1`/`localhost`.
- Phase 2 must validate extension, file signature/MIME where practical, count, and size before parsing.
- User-controlled workbook values are treated as plain data, never executable content.
- SQLite stores templates and metadata, not full uploaded workbooks unless the user explicitly opts in later.
- Original source files are never overwritten.
- Internal paths and exception details must not be returned to the UI.

