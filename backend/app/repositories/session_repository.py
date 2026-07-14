import json
from typing import Any

from app.database.connection import database
from app.models.validation_models import ValidationResult
from app.repositories.report_repository import ReportRepository


class SessionRepository:
    def save(self, result: ValidationResult, file_names: list[str]) -> None:
        with database() as connection:
            connection.execute(
                "INSERT OR REPLACE INTO sessions(id,project_name,mode,file_names,discrepancy_count,created_at,result_payload) VALUES(?,?,?,?,?,?,?)",
                (
                    result.id,
                    result.project_name,
                    result.preset,
                    json.dumps(file_names),
                    len(result.discrepancies),
                    result.created_at,
                    result.model_dump_json(),
                ),
            )

    def list_recent(self, limit: int = 10) -> list[dict[str, Any]]:
        with database() as connection:
            rows = connection.execute("SELECT * FROM sessions ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()

        sessions: list[dict[str, Any]] = []
        report_repository = ReportRepository()
        for row in rows:
            item = dict(row)
            try:
                item["file_names"] = json.loads(item.get("file_names") or "[]")
            except json.JSONDecodeError:
                item["file_names"] = []
            latest_report = report_repository.latest_info_for_session(str(item["id"]))
            item["has_report"] = latest_report is not None
            item["latest_report_filename"] = latest_report["filename"] if latest_report else None
            item.pop("result_payload", None)
            sessions.append(item)
        return sessions

    def get_result(self, session_id: str) -> ValidationResult | None:
        with database() as connection:
            row = connection.execute(
                "SELECT result_payload FROM sessions WHERE id = ? LIMIT 1",
                (session_id,),
            ).fetchone()

        if row is None or not row["result_payload"]:
            return None
        return ValidationResult.model_validate_json(row["result_payload"])
