from fastapi import APIRouter, File, UploadFile

from app.config.constants import MAX_FILES_PER_SESSION
from app.core.exceptions import AppError
from app.models.file_models import UploadedFile
from app.schemas.file_schemas import DataSourcePreviewRequest, DataSourcePreviewResponse, HeaderInspectionRequest
from app.services.extraction_service import preview_data_source
from app.services.file_service import get_file, save_upload
from app.services.sheet_service import inspect_header, inspect_sheets

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


@router.post("/data-source-preview", response_model=DataSourcePreviewResponse)
async def data_source_preview(request: DataSourcePreviewRequest) -> DataSourcePreviewResponse:
    return DataSourcePreviewResponse.model_validate(preview_data_source(request.data_source))


@router.post("/inspect-header")
async def inspect_header_row(request: HeaderInspectionRequest) -> dict[str, object]:
    _, path, _ = get_file(request.file_id)
    try:
        headers, samples = inspect_header(path, request.sheet_name, request.header_row)
    except ValueError as error:
        raise AppError(str(error), "INVALID_HEADER_ROW", 422) from error
    return {"headers": headers, "sample_rows": samples}
