from app.models.row_models import ExtractedRow
from app.models.validation_models import Discrepancy
from app.validators.base_validator import BaseValidator


class UnitCostValidator(BaseValidator[tuple[ExtractedRow, ExtractedRow], Discrepancy]):
    rule_id = "unit_cost"
    def validate(self, context):
        source, comparison = context
        if source.unit_cost == comparison.unit_cost: return []
        return [Discrepancy(issue_type="wrong_unit_cost", severity="high", source_file_name=comparison.source_file_name,
            reference_sheet=source.sheet_name, reference_row=source.excel_row_number, comparison_sheet=comparison.sheet_name,
            comparison_row=comparison.excel_row_number, reference_description=source.item_description,
            comparison_description=comparison.item_description, source_unit_cost=source.unit_cost,
            expected_value=str(source.unit_cost), actual_value=str(comparison.unit_cost),
            suggested_correction=f"Use source unit cost {source.unit_cost}.")]
