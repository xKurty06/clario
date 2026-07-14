from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from app.database.connection import database


class ReportRepository:
    def save(self, session_id: str, path: Path) -> None:
        with database() as connection:
            connection.execute(
                "INSERT INTO reports(id,session_id,file_name,path,created_at) VALUES(?,?,?,?,?)",
                (uuid4().hex, session_id, path.name, str(path.resolve()), datetime.now(timezone.utc).isoformat()),
            )

    def latest_for_session(self, session_id: str) -> Path | None:
        info = self.latest_info_for_session(session_id)
        return Path(info["path"]) if info else None

    def latest_info_for_session(self, session_id: str) -> dict[str, str] | None:
        with database() as connection:
            rows = connection.execute(
                "SELECT file_name, path, created_at FROM reports WHERE session_id = ? ORDER BY created_at DESC",
                (session_id,),
            ).fetchall()
        for row in rows:
            path = Path(row["path"])
            if path.exists():
                return {
                    "filename": row["file_name"] or path.name,
                    "path": str(path.resolve()),
                    "created_at": row["created_at"],
                }
        return None

    def find_for_session(self, session_id: str, path: str) -> Path | None:
        requested = str(Path(path).resolve())
        with database() as connection:
            row = connection.execute(
                "SELECT path FROM reports WHERE session_id = ? AND path = ? ORDER BY created_at DESC LIMIT 1",
                (session_id, requested),
            ).fetchone()
        if row is None:
            return None
        report_path = Path(row["path"])
        return report_path if report_path.exists() else None
