from decimal import Decimal

from app.models.row_models import ExtractedRow
from app.models.validation_models import ValidationRequest
from app.services.validation_service import run_validation


def make(file_id: str, quantity: str, unit_cost: str | None = None, total: str | None = None) -> ExtractedRow:
    return ExtractedRow(source_file_id=file_id, source_file_name=f"{file_id}.xlsx", sheet_name="Items", excel_row_number=2,
        item_number="1", item_description="Office chair", quantity=Decimal(quantity),
        unit_cost=Decimal(unit_cost) if unit_cost else None, total_cost=Decimal(total) if total else None)


def test_reference_bidder_abstract_uses_reference_quantity_for_expected_total() -> None:
    result = run_validation(ValidationRequest(project_name="Test", mode="reference_bidder_abstract",
        reference_rows=[make("reference", "2")], bidder_rows=[make("bidder", "99", "100")], abstract_rows=[make("abstract", "2", "100", "9900")]))
    issue = next(item for item in result.discrepancies if item.issue_type == "wrong_total_cost")
    assert issue.expected_value == "200"

