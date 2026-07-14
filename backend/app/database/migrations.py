from app.database.connection import database


LEGACY_SESSION_COLUMNS = {
    "id",
    "project_name",
    "mode",
    "file_names",
    "discrepancy_count",
    "created_at",
}


def migrate() -> None:
    with database() as connection:
        connection.executescript("""
        CREATE TABLE IF NOT EXISTS templates (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, file_role TEXT NOT NULL,
            payload TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY, project_name TEXT NOT NULL, mode TEXT NOT NULL,
            file_names TEXT NOT NULL, discrepancy_count INTEGER NOT NULL, created_at TEXT NOT NULL,
            result_payload TEXT
        );
        CREATE TABLE IF NOT EXISTS reports (
            id TEXT PRIMARY KEY, session_id TEXT NOT NULL, file_name TEXT NOT NULL,
            path TEXT NOT NULL, created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        """)

        columns = {row["name"] for row in connection.execute("PRAGMA table_info(sessions)").fetchall()}
        if LEGACY_SESSION_COLUMNS.issubset(columns) and "result_payload" not in columns:
            connection.execute("ALTER TABLE sessions ADD COLUMN result_payload TEXT")
