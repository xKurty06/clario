import json
from pathlib import Path
from typing import Any

from app.database.connection import database
from app.models.validation_models import ValidationRequest, ValidationResult
from app.repositories.report_repository import ReportRepository
from app.services.file_service import persist_file, restore_persisted_file
from app.services.session_storage_service import ensure_session_directory, read_result_file, read_session_files, read_setup_file, write_session_files
from app.services.sheet_service import inspect_sheets


class SessionRepository:
    def save(self, result: ValidationResult, file_names: list[str], request: ValidationRequest | None = None) -> None:
        with database() as connection:
            existing = connection.execute("SELECT session_path FROM sessions WHERE id = ? LIMIT 1", (result.id,)).fetchone()
            existing_path = str(existing["session_path"]) if existing and existing["session_path"] else None
            session_directory = ensure_session_directory(result.project_name, result.id, existing_path)
            persisted_files = []
            for source in request.data_sources if request else []:
                if any(item["id"] == source.file_id for item in persisted_files):
                    continue
                persisted_files.append(persist_file(source.file_id, session_directory / "uploads"))
            write_session_files(session_directory, result, request, persisted_files)
            connection.execute(
                "INSERT OR REPLACE INTO sessions(id,project_name,mode,file_names,discrepancy_count,created_at,result_payload,request_payload,session_path) VALUES(?,?,?,?,?,?,?,?,?)",
                (
                    result.id,
                    result.project_name,
                    result.preset,
                    json.dumps(file_names),
                    len(result.discrepancies),
                    result.created_at,
                    result.model_dump_json(),
                    request.model_dump_json() if request else None,
                    str(session_directory),
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
            item["can_reopen"] = bool(item.get("result_payload") or item.get("session_path"))
            item["can_continue_setup"] = bool(item.get("request_payload") or item.get("session_path"))
            item.pop("result_payload", None)
            item.pop("request_payload", None)
            sessions.append(item)
        return sessions

    def get_session_directory(self, session_id: str) -> Path | None:
        with database() as connection:
            row = connection.execute("SELECT session_path FROM sessions WHERE id = ? LIMIT 1", (session_id,)).fetchone()
        if row is None or not row["session_path"]:
            return None
        directory = Path(str(row["session_path"]))
        return directory if directory.exists() and directory.is_dir() else None

    def get_state(self, session_id: str) -> dict[str, Any] | None:
        with database() as connection:
            row = connection.execute(
                "SELECT result_payload, request_payload, session_path FROM sessions WHERE id = ? LIMIT 1",
                (session_id,),
            ).fetchone()

        if row is None:
            return None

        directory = Path(str(row["session_path"])) if row["session_path"] else None
        result = ValidationResult.model_validate_json(row["result_payload"]) if row["result_payload"] else None
        request = ValidationRequest.model_validate_json(row["request_payload"]) if row["request_payload"] else None

        if result is None and directory:
            result = read_result_file(directory)
        if request is None and directory:
            request = read_setup_file(directory)

        if result is None:
            return None
        files = []
        for item in read_session_files(directory) if directory else []:
            try:
                file_id = str(item["id"])
                name = str(item["name"])
                path = str(item["path"])
                size = int(item["size"])
                restore_persisted_file(file_id, name, path, size)
                file_path = Path(path)
                files.append({"id": file_id, "name": name, "extension": file_path.suffix.lower(), "size": size, "sheets": inspect_sheets(file_path)})
            except (KeyError, TypeError, ValueError, OSError):
                continue
        return {"result": result, "request": request, "files": files}
