from app.models.row_models import ExtractedRow
from app.models.validation_models import Discrepancy
from app.validators.base_validator import BaseValidator


class QuantityValidator(BaseValidator[tuple[ExtractedRow, ExtractedRow], Discrepancy]):
    rule_id = "quantity"
    def validate(self, context):
        reference, comparison = context
        if reference.quantity == comparison.quantity: return []
        return [Discrepancy(issue_type="quantity_mismatch", severity="high", source_file_name=comparison.source_file_name,
            reference_sheet=reference.sheet_name, reference_row=reference.excel_row_number, comparison_sheet=comparison.sheet_name,
            comparison_row=comparison.excel_row_number, reference_description=reference.item_description,
            comparison_description=comparison.item_description, reference_quantity=reference.quantity,
            comparison_quantity=comparison.quantity, expected_value=str(reference.quantity), actual_value=str(comparison.quantity),
            suggested_correction=f"Use reference quantity {reference.quantity}.")]
