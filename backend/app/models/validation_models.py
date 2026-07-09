from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

from app.models.row_models import ExtractedRow

IssueType = Literal["missing_item", "extra_item", "description_mismatch", "quantity_mismatch", "unit_mismatch", "wrong_unit_cost", "wrong_total_cost", "calculation_error", "duplicate_item", "blank_required_field", "invalid_number_format", "possible_shifted_row", "template_extraction_issue"]
Severity = Literal["low", "medium", "high"]
ComparisonMode = Literal["reference_vs_copied", "reference_bidder_abstract", "generic_two_file"]


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


class ValidationRequest(BaseModel):
    project_name: str = Field(default="Untitled validation", max_length=160)
    mode: ComparisonMode
    reference_rows: list[ExtractedRow]
    comparison_rows: list[ExtractedRow] = Field(default_factory=list)
    bidder_rows: list[ExtractedRow] = Field(default_factory=list)
    abstract_rows: list[ExtractedRow] = Field(default_factory=list)
    compare_fields: list[str] = Field(default_factory=lambda: ["description", "quantity"])
    case_insensitive: bool = True


class ValidationResult(BaseModel):
    id: str
    project_name: str
    mode: ComparisonMode
    created_at: str
    total_rows: int
    discrepancies: list[Discrepancy]
    breakdown: dict[str, int]
