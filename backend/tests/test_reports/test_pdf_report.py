from pathlib import Path

from app.models.validation_models import Discrepancy, ValidationResult
from app.reports.pdf_report_generator import PdfReportGenerator


def test_pdf_report_contains_summary_and_details(tmp_path: Path) -> None:
    result = ValidationResult(id="session", project_name="Office supplies", mode="reference_vs_copied",
        created_at="2026-07-08T00:00:00Z", total_rows=2,
        discrepancies=[Discrepancy(issue_type="quantity_mismatch", severity="high", source_file_name="copy.xlsx",
            comparison_sheet="Items", comparison_row=2, expected_value="2", actual_value="3", suggested_correction="Use 2")],
        breakdown={"quantity_mismatch": 1})
    destination = PdfReportGenerator().generate(result, tmp_path / "report.pdf")
    assert destination.exists() and destination.read_bytes().startswith(b"%PDF")

