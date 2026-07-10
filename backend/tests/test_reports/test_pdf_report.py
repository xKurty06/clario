from pathlib import Path

from app.models.comparison_models import ComparisonDataSource, ComparisonField, RuleDiscrepancy, RuleSummary, ValidationResult
from app.reports.pdf_report_generator import PdfReportGenerator


def test_pdf_report_contains_builder_summary_and_details(tmp_path: Path) -> None:
    result = ValidationResult(
        id="session",
        project_name="Office supplies",
        preset="reference_vs_copied",
        created_at="2026-07-08T00:00:00Z",
        file_names=["reference.xlsx", "copy.xlsx"],
        total_selected_rows=2,
        data_sources=[
            ComparisonDataSource(
                id="source-1",
                name="Reference source",
                file_id="reference",
                file_name="reference.xlsx",
                sheet_name="Items",
                header_row=1,
                first_data_row=2,
                selected_row_numbers=[2],
                fields=[
                    ComparisonField(id="field-1", data_source_id="source-1", field_name="Description", field_type="text", column_letter="B"),
                ],
            ),
        ],
        rule_summaries=[RuleSummary(rule_id="rule-1", rule_name="Description compare", rule_type="compare_values", severity="high", discrepancy_count=1)],
        discrepancies=[
            RuleDiscrepancy(
                rule_id="rule-1",
                rule_name="Description compare",
                rule_type="compare_values",
                severity="high",
                left_file_name="reference.xlsx",
                left_sheet_name="Items",
                left_row_number=2,
                right_file_name="copy.xlsx",
                right_sheet_name="Items",
                right_row_number=2,
                expected_value="Bond paper",
                actual_value="Bond paper A4",
                suggested_correction="Align description",
                notes="Compared using normalized exact.",
            )
        ],
        breakdown={"high": 1},
    )
    destination = PdfReportGenerator().generate(result, tmp_path / "report.pdf")
    assert destination.exists() and destination.read_bytes().startswith(b"%PDF")
