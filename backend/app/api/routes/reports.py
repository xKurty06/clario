import os
import platform
import subprocess
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.models.validation_models import ValidationResult
from app.repositories.report_repository import ReportRepository
from app.services.report_service import create_pdf

router = APIRouter(prefix="/reports", tags=["reports"])


class OpenReportRequest(BaseModel):
    path: str | None = None


class ReportInfoResponse(BaseModel):
    filename: str
    saved_path: str
    created_at: str


def report_headers(path: Path) -> dict[str, str]:
    resolved = path.resolve()
    return {
        "Cache-Control": "no-store",
        "X-Report-Path": str(resolved),
        "X-Report-Filename": path.name,
    }


def open_with_default_app(path: Path) -> None:
    """Open a generated local PDF with the operating system's default app."""
    resolved = path.resolve()
    if not resolved.exists():
        raise FileNotFoundError(str(resolved))

    system = platform.system()
    if system == "Windows":
        os.startfile(str(resolved))  # type: ignore[attr-defined]
        return
    if system == "Darwin":
        subprocess.Popen(["open", str(resolved)])
        return
    subprocess.Popen(["xdg-open", str(resolved)])


@router.get("/capabilities")
async def report_capabilities() -> dict[str, str]:
    return {"status": "ready", "format": "pdf"}


@router.get("/{session_id}/latest", response_model=ReportInfoResponse)
async def latest_pdf_report(session_id: str) -> ReportInfoResponse:
    info = ReportRepository().latest_info_for_session(session_id)
    if info is None:
        raise HTTPException(status_code=404, detail="Generated report was not found. Export the report again.")
    return ReportInfoResponse(filename=info["filename"], saved_path=info["path"], created_at=info["created_at"])


@router.post("/{session_id}/open")
async def open_pdf_external(session_id: str, request: OpenReportRequest | None = None) -> dict[str, str]:
    repository = ReportRepository()
    requested_path = request.path if request and request.path else None
    path = repository.find_for_session(session_id, requested_path) if requested_path else repository.latest_for_session(session_id)
    if path is None:
        raise HTTPException(status_code=404, detail="Generated report was not found. Export the report again.")
    try:
        open_with_default_app(path)
    except OSError as exc:
        raise HTTPException(status_code=500, detail="The report was created, but the operating system could not open it automatically.") from exc
    return {"status": "opened", "path": str(path.resolve())}


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
        headers=report_headers(path),
    )


@router.post("/pdf", response_class=FileResponse)
async def export_pdf(result: ValidationResult) -> FileResponse:
    path = create_pdf(result)
    return FileResponse(
        path,
        media_type="application/pdf",
        filename=path.name,
        headers=report_headers(path),
    )
