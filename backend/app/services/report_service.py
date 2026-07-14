from pathlib import Path

from app.config.settings import get_settings
from app.models.validation_models import ValidationResult
from app.reports.pdf_report_generator import PdfReportGenerator
from app.repositories.report_repository import ReportRepository
from app.repositories.session_repository import SessionRepository
from app.services.session_storage_service import ensure_session_directory


def next_report_number(report_directory: Path) -> int:
    report_directory.mkdir(parents=True, exist_ok=True)
    highest = 0
    for path in report_directory.glob("report-*.pdf"):
        parts = path.stem.split("-")
        if len(parts) > 1 and parts[1].isdigit():
            highest = max(highest, int(parts[1]))
    return highest + 1


def create_pdf(result: ValidationResult) -> Path:
    session_directory = SessionRepository().get_session_directory(result.id)
    if session_directory is None:
        session_directory = ensure_session_directory(result.project_name, result.id)
    report_directory = session_directory / "reports"
    report_number = next_report_number(report_directory)
    destination = report_directory / f"report-{report_number}-{result.id[:8]}.pdf"
    path = PdfReportGenerator().generate(result, destination)
    ReportRepository().save(result.id, path)
    return path
