from fastapi import APIRouter, File, UploadFile

from app.config.constants import MAX_FILES_PER_SESSION
from app.core.exceptions import AppError
from app.extractors.row_extractor import extract_rows
from app.models.file_models import UploadedFile
from app.schemas.file_schemas import HeaderInspectionRequest, PreviewRequest, PreviewResponse
from app.services.file_service import get_file, save_upload
from app.services.sheet_service import inspect_header, inspect_sheets
from app.utils.column_utils import suggest_columns

router = APIRouter(prefix="/files", tags=["files"])


@router.get("/capabilities")
async def file_capabilities() -> dict[str, object]:
    return {"status": "ready", "supported_extensions": [".xlsx", ".xls", ".csv"], "max_files": MAX_FILES_PER_SESSION, "max_file_size_mb": 50}


@router.post("/upload", response_model=list[UploadedFile])
async def upload_files(files: list[UploadFile] = File(...)) -> list[UploadedFile]:
    if not 1 <= len(files) <= MAX_FILES_PER_SESSION:
        raise AppError(f"Choose between 1 and {MAX_FILES_PER_SESSION} files.", "INVALID_FILE_COUNT", 422)
    results = []
    for upload in files:
        identifier, name, path, size = await save_upload(upload)
        try:
            sheets = inspect_sheets(path)
        except Exception as error:
            path.unlink(missing_ok=True)
            raise AppError(f"Could not read {name}. The file may be corrupted.", "FILE_PARSE_ERROR", 422) from error
        results.append(UploadedFile(id=identifier, name=name, extension=path.suffix.lower(), size=size, sheets=sheets))
    return results


@router.post("/suggest-columns")
async def column_suggestions(payload: dict[str, object]) -> dict[str, object]:
    headers = [str(value) for value in payload.get("headers", [])]
    sample_rows = payload.get("sample_rows", [])
    return {"suggestions": suggest_columns(headers, sample_rows if isinstance(sample_rows, list) else [])}


@router.post("/preview", response_model=PreviewResponse)
async def preview_rows(request: PreviewRequest) -> PreviewResponse:
    name, path, _ = get_file(request.file_id)
    rows = extract_rows(request.file_id, name, path, request.template)
    return PreviewResponse(rows=rows[:500], total=len(rows))


@router.post("/inspect-header")
async def inspect_header_row(request: HeaderInspectionRequest) -> dict[str, object]:
    _, path, _ = get_file(request.file_id)
    try:
        headers, samples = inspect_header(path, request.sheet_name, request.header_row)
    except ValueError as error:
        raise AppError(str(error), "INVALID_HEADER_ROW", 422) from error
    return {"headers": headers, "sample_rows": samples}
