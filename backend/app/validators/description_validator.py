from app.models.row_models import ExtractedRow
from app.models.validation_models import Discrepancy
from app.normalizers.text_normalizer import normalize_text
from app.validators.base_validator import BaseValidator


class DescriptionValidator(BaseValidator[tuple[ExtractedRow, ExtractedRow, bool], Discrepancy]):
    rule_id = "description"
    def validate(self, context):
        reference, comparison, insensitive = context
        if normalize_text(reference.item_description, insensitive) == normalize_text(comparison.item_description, insensitive): return []
        return [Discrepancy(issue_type="description_mismatch", severity="high", source_file_name=comparison.source_file_name,
            reference_sheet=reference.sheet_name, reference_row=reference.excel_row_number, comparison_sheet=comparison.sheet_name,
            comparison_row=comparison.excel_row_number, reference_description=reference.item_description,
            comparison_description=comparison.item_description, expected_value=reference.item_description,
            actual_value=comparison.item_description, suggested_correction="Review and copy the exact reference description.",
            notes="Strict comparison; specifications and wording are not treated as equivalent.")]
