import json
import re
from pathlib import Path
from typing import Any

from app.config.settings import get_settings
from app.models.validation_models import ValidationRequest, ValidationResult

INVALID_PATH_CHARS = re.compile(r'[<>:"/\\|?*\x00-\x1f]+')


def safe_session_folder_name(project_name: str) -> str:
    cleaned = INVALID_PATH_CHARS.sub("-", project_name).strip(" .")
    cleaned = re.sub(r"\s+", " ", cleaned)[:80].strip(" .")
    return cleaned or "validation-session"


def session_root_directory() -> Path:
    return get_settings().sessions_directory


def _metadata_path(directory: Path) -> Path:
    return directory / "session.json"


def _read_session_id(directory: Path) -> str | None:
    metadata_file = _metadata_path(directory)
    if not metadata_file.exists():
        return None
    try:
        metadata = json.loads(metadata_file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    value = metadata.get("id")
    return str(value) if value else None


def ensure_session_directory(project_name: str, session_id: str, existing_path: str | None = None) -> Path:
    root = session_root_directory()
    root.mkdir(parents=True, exist_ok=True)

    if existing_path:
        existing = Path(existing_path)
        if existing.exists() and existing.is_dir():
            _ensure_children(existing)
            return existing

    base_name = safe_session_folder_name(project_name)
    candidate = root / base_name
    index = 2
    while candidate.exists():
        existing_session_id = _read_session_id(candidate)
        if existing_session_id == session_id:
            _ensure_children(candidate)
            return candidate
        candidate = root / f"{base_name} ({index})"
        index += 1

    _ensure_children(candidate)
    return candidate


def _ensure_children(directory: Path) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    for child in ("uploads", "previews", "reports"):
        (directory / child).mkdir(parents=True, exist_ok=True)


def write_session_files(directory: Path, result: ValidationResult, request: ValidationRequest | None = None) -> None:
    _ensure_children(directory)
    metadata: dict[str, Any] = {
        "id": result.id,
        "project_name": result.project_name,
        "preset": result.preset,
        "created_at": result.created_at,
        "discrepancy_count": len(result.discrepancies),
        "file_names": result.file_names,
    }
    (_metadata_path(directory)).write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    (directory / "result.json").write_text(result.model_dump_json(indent=2), encoding="utf-8")
    if request:
        (directory / "setup.json").write_text(request.model_dump_json(indent=2), encoding="utf-8")


def read_result_file(directory: Path) -> ValidationResult | None:
    result_file = directory / "result.json"
    if not result_file.exists():
        return None
    try:
        return ValidationResult.model_validate_json(result_file.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def read_setup_file(directory: Path) -> ValidationRequest | None:
    setup_file = directory / "setup.json"
    if not setup_file.exists():
        return None
    try:
        return ValidationRequest.model_validate_json(setup_file.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
