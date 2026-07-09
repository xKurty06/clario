import re
from pathlib import Path

from app.config.settings import get_settings
from app.models.validation_models import ValidationResult
from app.reports.pdf_report_generator import PdfReportGenerator
from app.repositories.report_repository import ReportRepository


def create_pdf(result: ValidationResult) -> Path:
    safe = re.sub(r"[^A-Za-z0-9_-]", "-", result.project_name).strip("-")[:80] or "validation-report"
    destination = get_settings().report_directory / f"{safe}-{result.id[:8]}.pdf"
    path = PdfReportGenerator().generate(result, destination)
    ReportRepository().save(result.id, path)
    return path
