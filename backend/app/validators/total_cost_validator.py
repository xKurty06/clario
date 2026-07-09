from decimal import Decimal

from app.models.row_models import ExtractedRow
from app.models.validation_models import Discrepancy
from app.validators.base_validator import BaseValidator


class TotalCostValidator(BaseValidator[tuple[ExtractedRow, Decimal | None], Discrepancy]):
    rule_id = "total_cost"
    def validate(self, context):
        row, expected = context
        if expected is None or row.total_cost == expected: return []
        return [Discrepancy(issue_type="wrong_total_cost", severity="high", source_file_name=row.source_file_name,
            comparison_sheet=row.sheet_name, comparison_row=row.excel_row_number, comparison_description=row.item_description,
            source_unit_cost=row.unit_cost, source_total_cost=row.total_cost, expected_value=str(expected), actual_value=str(row.total_cost),
            suggested_correction=f"Expected total is {expected}.", notes="Calculated from the selected authoritative quantity and unit cost.")]
