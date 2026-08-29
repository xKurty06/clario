import json
import shutil
from pathlib import Path
from typing import Any

from app.config.settings import get_settings
from app.database.connection import database
from app.models.validation_models import ValidationRequest, ValidationResult
from app.repositories.report_repository import ReportRepository
from app.services.file_service import persist_file, restore_persisted_file
from app.services.session_storage_service import ensure_session_directory, read_result_file, read_session_files, read_setup_file, write_session_files
from app.services.sheet_service import inspect_sheets


class SessionRepository:
    @staticmethod
    def _session_directory_path(raw_path: str | None) -> Path | None:
        if raw_path in (None, ""):
            return None
        path = Path(str(raw_path))
        if not path.is_absolute():
            path = get_settings().data_directory / path
        return path.resolve()

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

    def rename(self, session_id: str, project_name: str) -> bool:
        with database() as connection:
            row = connection.execute(
                "SELECT result_payload, request_payload, session_path FROM sessions WHERE id = ? LIMIT 1",
                (session_id,),
            ).fetchone()
            if row is None:
                return False

            result_payload = json.loads(row["result_payload"]) if row["result_payload"] else None
            request_payload = json.loads(row["request_payload"]) if row["request_payload"] else None
            if result_payload:
                result_payload["project_name"] = project_name
            if request_payload:
                request_payload["project_name"] = project_name

            connection.execute(
                "UPDATE sessions SET project_name = ?, result_payload = ?, request_payload = ? WHERE id = ?",
                (
                    project_name,
                    json.dumps(result_payload) if result_payload else None,
                    json.dumps(request_payload) if request_payload else None,
                    session_id,
                ),
            )

            session_path = self._session_directory_path(row["session_path"])
            if session_path and session_path.exists() and session_path.is_dir():
                metadata_path = session_path / "session.json"
                result_path = session_path / "result.json"
                setup_path = session_path / "setup.json"
                if metadata_path.exists():
                    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
                    metadata["project_name"] = project_name
                    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
                if result_path.exists() and result_payload:
                    result_path.write_text(json.dumps(result_payload, indent=2), encoding="utf-8")
                if setup_path.exists() and request_payload:
                    setup_path.write_text(json.dumps(request_payload, indent=2), encoding="utf-8")
            return True

    def delete(self, session_id: str) -> bool:
        with database() as connection:
            row = connection.execute("SELECT session_path FROM sessions WHERE id = ? LIMIT 1", (session_id,)).fetchone()
            if row is None:
                return False

            session_path = self._session_directory_path(row["session_path"])
            if session_path:
                sessions_root = get_settings().sessions_directory.resolve()
                if session_path != sessions_root and sessions_root not in session_path.parents:
                    raise ValueError("The saved session path is outside the sessions directory.")
                if session_path.exists():
                    try:
                        shutil.rmtree(session_path)
                    except (PermissionError, OSError):
                        # Windows can keep files locked while a spreadsheet or another app still has them open.
                        # Treat the folder cleanup as best-effort so the saved session record can still be removed.
                        pass

            connection.execute("DELETE FROM reports WHERE session_id = ?", (session_id,))
            cursor = connection.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
            return cursor.rowcount > 0

    def get_session_directory(self, session_id: str) -> Path | None:
        with database() as connection:
            row = connection.execute("SELECT session_path FROM sessions WHERE id = ? LIMIT 1", (session_id,)).fetchone()
        if row is None or not row["session_path"]:
            return None
        directory = self._session_directory_path(row["session_path"])
        return directory if directory and directory.exists() and directory.is_dir() else None

    def get_state(self, session_id: str) -> dict[str, Any] | None:
        with database() as connection:
            row = connection.execute(
                "SELECT result_payload, request_payload, session_path FROM sessions WHERE id = ? LIMIT 1",
                (session_id,),
            ).fetchone()

        if row is None:
            return None

        directory = self._session_directory_path(row["session_path"])
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
