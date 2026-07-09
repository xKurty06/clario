import json

from app.database.connection import database
from app.models.validation_models import ValidationResult


class SessionRepository:
    def save(self, result: ValidationResult, file_names: list[str]) -> None:
        with database() as connection:
            connection.execute("INSERT OR REPLACE INTO sessions(id,project_name,mode,file_names,discrepancy_count,created_at) VALUES(?,?,?,?,?,?)",
                (result.id, result.project_name, result.mode, json.dumps(file_names), len(result.discrepancies), result.created_at))

    def list_recent(self, limit: int = 10) -> list[dict[str, object]]:
        with database() as connection:
            rows = connection.execute("SELECT * FROM sessions ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
        return [dict(row) for row in rows]
