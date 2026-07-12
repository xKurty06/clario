from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from app.database.connection import database


class ReportRepository:
    def save(self, session_id: str, path: Path) -> None:
        with database() as connection:
            connection.execute("INSERT INTO reports(id,session_id,file_name,path,created_at) VALUES(?,?,?,?,?)",
                (uuid4().hex, session_id, path.name, str(path), datetime.now(timezone.utc).isoformat()))

    def latest_for_session(self, session_id: str) -> Path | None:
        with database() as connection:
            row = connection.execute(
                "SELECT path FROM reports WHERE session_id = ? ORDER BY created_at DESC LIMIT 1",
                (session_id,),
            ).fetchone()
        if row is None:
            return None
        path = Path(row["path"])
        return path if path.exists() else None
