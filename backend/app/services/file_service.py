import json
import re
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from app.config.constants import MAX_FILE_SIZE_BYTES, SUPPORTED_FILE_EXTENSIONS
from app.config.settings import get_settings
from app.core.exceptions import AppError, UnsupportedFileError

_files: dict[str, tuple[str, Path, int]] = {}
_SAFE_FILE_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]+$")


def _safe_name(name: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._ -]", "_", Path(name).name).strip()
    return cleaned[:180] or "uploaded-file"


def _metadata_path(file_id: str) -> Path:
    return get_settings().upload_directory / f"{file_id}.metadata.json"


def _write_file_metadata(file_id: str, original_name: str, path: Path, size: int) -> None:
    metadata = {
        "id": file_id,
        "original_name": original_name,
        "stored_name": path.name,
        "size": size,
    }
    _metadata_path(file_id).write_text(json.dumps(metadata), encoding="utf-8")


def _read_file_metadata(file_id: str) -> tuple[str, Path, int] | None:
    metadata_file = _metadata_path(file_id)
    if not metadata_file.exists():
        return None
    try:
        metadata = json.loads(metadata_file.read_text(encoding="utf-8"))
        original_name = _safe_name(str(metadata.get("original_name") or "uploaded-file"))
        stored_name = Path(str(metadata.get("stored_name") or "")).name
        size = int(metadata.get("size") or 0)
    except (OSError, ValueError, TypeError, json.JSONDecodeError):
        return None
    if not stored_name:
        return None
    path = get_settings().upload_directory / stored_name
    if not path.exists() or not path.is_file():
        return None
    result = (original_name, path, size or path.stat().st_size)
    _files[file_id] = result
    return result


def _recover_file_from_disk(file_id: str) -> tuple[str, Path, int] | None:
    if not _SAFE_FILE_ID_PATTERN.fullmatch(file_id):
        return None
    directory = get_settings().upload_directory
    if not directory.exists():
        return None
    for candidate in directory.glob(f"{file_id}.*"):
        if candidate.suffix == ".json" or not candidate.is_file():
            continue
        result = (candidate.name, candidate, candidate.stat().st_size)
        _files[file_id] = result
        return result
    return None


async def save_upload(upload: UploadFile) -> tuple[str, str, Path, int]:
    original_name = _safe_name(upload.filename or "uploaded-file")
    extension = Path(original_name).suffix.lower()
    if extension not in SUPPORTED_FILE_EXTENSIONS:
        raise UnsupportedFileError()
    content = await upload.read(MAX_FILE_SIZE_BYTES + 1)
    if not content or len(content) > MAX_FILE_SIZE_BYTES:
        raise UnsupportedFileError("The file is empty or exceeds the 50 MB limit.")
    identifier = uuid4().hex
    directory = get_settings().upload_directory
    directory.mkdir(parents=True, exist_ok=True)
    destination = directory / f"{identifier}{extension}"
    destination.write_bytes(content)
    _files[identifier] = (original_name, destination, len(content))
    _write_file_metadata(identifier, original_name, destination, len(content))
    return identifier, original_name, destination, len(content)


def get_file(file_id: str) -> tuple[str, Path, int]:
    result = _files.get(file_id) or _read_file_metadata(file_id) or _recover_file_from_disk(file_id)
    if not result:
        raise AppError("The working file is unavailable. Upload it again.", "FILE_NOT_FOUND", 404)
    return result
