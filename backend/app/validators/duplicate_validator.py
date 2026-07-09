from collections import defaultdict

from app.models.row_models import ExtractedRow
from app.models.validation_models import Discrepancy
from app.normalizers.text_normalizer import normalize_text
from app.validators.base_validator import BaseValidator


class DuplicateValidator(BaseValidator[list[ExtractedRow], Discrepancy]):
    rule_id = "duplicate"
    def validate(self, rows):
        groups = defaultdict(list)
        for row in rows: groups[normalize_text(row.item_description, True)].append(row)
        return [Discrepancy(issue_type="duplicate_item", severity="medium", source_file_name=row.source_file_name,
            comparison_sheet=row.sheet_name, comparison_row=row.excel_row_number, comparison_description=row.item_description,
            suggested_correction="Confirm whether this repeated item is intentional.") for group in groups.values() if len(group) > 1 for row in group[1:]]
