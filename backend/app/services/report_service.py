import re
from pathlib import Path

from app.config.settings import get_settings
from app.models.validation_models import ValidationResult
from app.reports.pdf_report_generator import PdfReportGenerator
from app.repositories.report_repository import ReportRepository


INVALID_PATH_CHARS = re.compile(r'[<>:"/\\|?*\x00-\x1f]+')


def safe_session_folder_name(project_name: str) -> str:
    cleaned = INVALID_PATH_CHARS.sub("-", project_name).strip(" .")
    cleaned = re.sub(r"\s+", " ", cleaned)[:80].strip(" .")
    return cleaned or "validation-session"


def next_report_number(report_directory: Path) -> int:
    report_directory.mkdir(parents=True, exist_ok=True)
    highest = 0
    for path in report_directory.glob("report-*.pdf"):
        match = re.match(r"report-(\d+)-", path.name, re.IGNORECASE)
        if match:
            highest = max(highest, int(match.group(1)))
    return highest + 1


def create_pdf(result: ValidationResult) -> Path:
    settings = get_settings()
    session_directory = settings.data_directory / "sessions" / safe_session_folder_name(result.project_name)
    report_directory = session_directory / "reports"
    report_number = next_report_number(report_directory)
    destination = report_directory / f"report-{report_number}-{result.id[:8]}.pdf"
    path = PdfReportGenerator().generate(result, destination)
    ReportRepository().save(result.id, path)
    return path
