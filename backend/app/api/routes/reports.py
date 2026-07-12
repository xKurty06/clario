from fastapi import APIRouter
from fastapi.responses import FileResponse

from app.models.validation_models import ValidationResult
from app.services.report_service import create_pdf

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/capabilities")
async def report_capabilities() -> dict[str, str]:
    return {"status": "ready", "format": "pdf"}


@router.post("/pdf", response_class=FileResponse)
async def export_pdf(result: ValidationResult) -> FileResponse:
    path = create_pdf(result)
    return FileResponse(
        path,
        media_type="application/pdf",
        filename=path.name,
        headers={"X-Report-Path": str(path.resolve())},
    )
