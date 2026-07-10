from decimal import Decimal
from typing import Literal

from pydantic import BaseModel

from app.models.comparison_models import (
    ComparisonDataSource,
    ComparisonField,
    ComparisonRule,
    DataSourcePreview,
    ExtractedFieldValue,
    ExtractedRecord,
    FormulaSettings,
    RuleDiscrepancy,
    RuleSummary,
    ValidationRequest,
    ValidationResult,
)

IssueType = Literal["missing_item", "extra_item", "description_mismatch", "quantity_mismatch", "unit_mismatch", "wrong_unit_cost", "wrong_total_cost", "calculation_error", "duplicate_item", "blank_required_field", "invalid_number_format", "possible_shifted_row", "template_extraction_issue"]
Severity = Literal["low", "medium", "high"]


class Discrepancy(BaseModel):
    issue_type: IssueType
    severity: Severity
    source_file_name: str
    reference_sheet: str | None = None
    reference_row: int | None = None
    comparison_sheet: str | None = None
    comparison_row: int | None = None
    reference_description: str | None = None
    comparison_description: str | None = None
    reference_quantity: Decimal | None = None
    comparison_quantity: Decimal | None = None
    source_unit_cost: Decimal | None = None
    source_total_cost: Decimal | None = None
    expected_value: str | None = None
    actual_value: str | None = None
    suggested_correction: str | None = None
    notes: str | None = None


__all__ = [
    "ComparisonDataSource",
    "ComparisonField",
    "ComparisonRule",
    "DataSourcePreview",
    "Discrepancy",
    "ExtractedFieldValue",
    "ExtractedRecord",
    "FormulaSettings",
    "RuleDiscrepancy",
    "RuleSummary",
    "ValidationRequest",
    "ValidationResult",
]
