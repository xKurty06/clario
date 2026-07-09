import re
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from app.config.constants import MAX_FILE_SIZE_BYTES, SUPPORTED_FILE_EXTENSIONS
from app.config.settings import get_settings
from app.core.exceptions import UnsupportedFileError

_files: dict[str, tuple[str, Path, int]] = {}


def _safe_name(name: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._ -]", "_", Path(name).name).strip()
    return cleaned[:180] or "uploaded-file"


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
    return identifier, original_name, destination, len(content)


def get_file(file_id: str) -> tuple[str, Path, int]:
    result = _files.get(file_id)
    if not result:
        from app.core.exceptions import AppError
        raise AppError("The working file is unavailable. Upload it again.", "FILE_NOT_FOUND", 404)
    return result
