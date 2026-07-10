from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

FieldType = Literal["text", "number", "currency", "date", "boolean", "raw"]
RowSelectionMode = Literal["auto_detected", "manual_include", "manual_exclude"]
RuleType = Literal["compare_values", "formula_check", "required_field_check", "duplicate_check"]
MatchStrategy = Literal["by_row_order", "by_item_number_field", "by_exact_text_field", "by_multiple_fields", "manual_placeholder"]
RuleStrictness = Literal["exact", "normalized_exact", "numeric_tolerance", "currency_tolerance"]
Severity = Literal["low", "medium", "high"]
PresetType = Literal["reference_vs_copied", "reference_bidder_abstract", "generic_two_file", "custom_comparison_builder"]
FormulaOperator = Literal["add", "subtract", "multiply", "divide"]


class NormalizationSettings(BaseModel):
    case_insensitive: bool = True
    trim_whitespace: bool = True
    collapse_whitespace: bool = True


class ComparisonField(BaseModel):
    id: str
    data_source_id: str
    field_name: str = Field(min_length=1, max_length=120)
    field_type: FieldType = "text"
    column_letter: str = Field(min_length=1, max_length=8)
    original_header_label: str | None = None
    custom_display_name: str | None = None
    required: bool = False
    normalization: NormalizationSettings = Field(default_factory=NormalizationSettings)

    @property
    def display_name(self) -> str:
        return self.custom_display_name or self.field_name


class ComparisonDataSource(BaseModel):
    id: str
    name: str = Field(min_length=1, max_length=120)
    file_id: str
    file_name: str | None = None
    sheet_name: str
    header_row: int = Field(ge=1, le=1000)
    first_data_row: int = Field(ge=1, le=1_000_000)
    selected_row_numbers: list[int] = Field(default_factory=list)
    ignored_row_numbers: list[int] = Field(default_factory=list)
    row_selection_mode: RowSelectionMode = "auto_detected"
    fields: list[ComparisonField] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_rows(self) -> "ComparisonDataSource":
        if self.first_data_row <= self.header_row:
            raise ValueError("first_data_row must be after header_row")
        return self


class ColumnReference(BaseModel):
    index: int
    letter: str
    header_label: str
    display_label: str


class PreviewRow(BaseModel):
    row_number: int
    selected: bool
    ignored: bool
    cells: dict[str, Any] = Field(default_factory=dict)


class DataSourcePreview(BaseModel):
    data_source: ComparisonDataSource
    columns: list[ColumnReference]
    rows: list[PreviewRow]
    total_rows: int
    detected_selected_rows: list[int] = Field(default_factory=list)


class ExtractedFieldValue(BaseModel):
    field_id: str
    field_name: str
    display_name: str
    field_type: FieldType
    column_letter: str
    original_header_label: str | None = None
    raw_value: Any = None
    normalized_value: Any = None


class ExtractedRecord(BaseModel):
    source_file_id: str
    source_file_name: str
    data_source_id: str
    data_source_name: str
    sheet_name: str
    excel_row_number: int
    field_values: dict[str, ExtractedFieldValue] = Field(default_factory=dict)
    raw_row: dict[str, Any] = Field(default_factory=dict)
    extraction_issues: list[str] = Field(default_factory=list)


class FormulaSettings(BaseModel):
    operator: FormulaOperator = "multiply"
    operand_field_ids: list[str] = Field(default_factory=list, min_length=2, max_length=2)
    result_field_id: str


class ComparisonRule(BaseModel):
    id: str
    rule_name: str = Field(min_length=1, max_length=160)
    rule_type: RuleType
    left_data_source_id: str | None = None
    left_field_id: str | None = None
    right_data_source_id: str | None = None
    right_field_id: str | None = None
    left_match_field_ids: list[str] = Field(default_factory=list)
    right_match_field_ids: list[str] = Field(default_factory=list)
    match_strategy: MatchStrategy = "by_row_order"
    strictness: RuleStrictness = "normalized_exact"
    numeric_tolerance: Decimal | None = None
    currency_tolerance: Decimal | None = None
    formula_settings: FormulaSettings | None = None
    severity: Severity = "medium"
    enabled: bool = True


class ValidationRequest(BaseModel):
    project_name: str = Field(default="Untitled validation", max_length=160)
    preset: PresetType = "custom_comparison_builder"
    data_sources: list[ComparisonDataSource] = Field(default_factory=list)
    rules: list[ComparisonRule] = Field(default_factory=list)


class RuleSummary(BaseModel):
    rule_id: str
    rule_name: str
    rule_type: RuleType
    severity: Severity
    discrepancy_count: int


class RuleDiscrepancy(BaseModel):
    rule_id: str
    rule_name: str
    rule_type: RuleType
    severity: Severity
    left_file_name: str | None = None
    left_sheet_name: str | None = None
    left_row_number: int | None = None
    left_field_name: str | None = None
    right_file_name: str | None = None
    right_sheet_name: str | None = None
    right_row_number: int | None = None
    right_field_name: str | None = None
    expected_value: str | None = None
    actual_value: str | None = None
    suggested_correction: str | None = None
    notes: str | None = None


class ValidationResult(BaseModel):
    id: str
    project_name: str
    preset: PresetType
    created_at: str
    file_names: list[str] = Field(default_factory=list)
    total_selected_rows: int
    data_sources: list[ComparisonDataSource] = Field(default_factory=list)
    extracted_records: list[ExtractedRecord] = Field(default_factory=list)
    rule_summaries: list[RuleSummary] = Field(default_factory=list)
    discrepancies: list[RuleDiscrepancy] = Field(default_factory=list)
    breakdown: dict[str, int] = Field(default_factory=dict)
