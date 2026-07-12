from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from app.models.validation_models import ValidationResult
from app.repositories.report_repository import ReportRepository
from app.services.report_service import create_pdf

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/capabilities")
async def report_capabilities() -> dict[str, str]:
    return {"status": "ready", "format": "pdf"}


@router.get("/{session_id}/pdf", response_class=FileResponse)
async def open_pdf(session_id: str, download: bool = Query(default=False)) -> FileResponse:
    path = ReportRepository().latest_for_session(session_id)
    if path is None:
        raise HTTPException(status_code=404, detail="Generated report was not found. Export the report again.")
    return FileResponse(
        path,
        media_type="application/pdf",
        filename=path.name,
        content_disposition_type="attachment" if download else "inline",
        headers={"X-Report-Path": str(path.resolve())},
    )


@router.post("/pdf", response_class=FileResponse)
async def export_pdf(result: ValidationResult) -> FileResponse:
    path = create_pdf(result)
    return FileResponse(
        path,
        media_type="application/pdf",
        filename=path.name,
        headers={"X-Report-Path": str(path.resolve())},
    )
