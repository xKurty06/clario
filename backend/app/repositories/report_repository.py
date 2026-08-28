from datetime import datetime, timezone
from pathlib import Path
import re
from uuid import uuid4

from app.database.connection import database


class ReportRepository:
    @staticmethod
    def is_report_file(path: Path, session_id: str) -> bool:
        return re.fullmatch(rf"report-\d+-{re.escape(session_id[:8])}\.pdf", path.name, re.IGNORECASE) is not None

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
        reports = self.info_for_session(session_id)
        return reports[0] if reports else None

    def info_for_session(self, session_id: str) -> list[dict[str, str]]:
        with database() as connection:
            rows = connection.execute(
                "SELECT file_name, path, created_at FROM reports WHERE session_id = ? ORDER BY created_at DESC",
                (session_id,),
            ).fetchall()
            session = connection.execute(
                "SELECT session_path FROM sessions WHERE id = ? LIMIT 1",
                (session_id,),
            ).fetchone()

        if session is None or not session["session_path"]:
            return []

        reports_directory = Path(str(session["session_path"])) / "reports"
        if not reports_directory.is_dir():
            return []

        stored_by_path = {str(Path(row["path"]).resolve()): row for row in rows}
        reports = []
        for path in reports_directory.glob("*.pdf"):
            if not path.is_file() or not self.is_report_file(path, session_id):
                continue
            resolved_path = str(path.resolve())
            row = stored_by_path.get(resolved_path)
            modified_at = path.stat().st_mtime
            reports.append({
                "filename": row["file_name"] if row else path.name,
                "path": resolved_path,
                "created_at": row["created_at"] if row else datetime.fromtimestamp(modified_at, timezone.utc).isoformat(),
                "sort_key": str(modified_at),
            })

        reports.sort(key=lambda report: float(report["sort_key"]), reverse=True)
        for report in reports:
            report.pop("sort_key")
        return reports

    def find_for_session(self, session_id: str, path: str) -> Path | None:
        requested = str(Path(path).resolve())
        with database() as connection:
            session = connection.execute(
                "SELECT session_path FROM sessions WHERE id = ? LIMIT 1",
                (session_id,),
            ).fetchone()
        if session is None or not session["session_path"]:
            return None
        reports_directory = (Path(str(session["session_path"])) / "reports").resolve()
        report_path = Path(requested)
        if report_path.parent != reports_directory or not self.is_report_file(report_path, session_id):
            return None
        return report_path if report_path.is_file() else None
