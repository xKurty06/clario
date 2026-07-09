from decimal import Decimal

from app.models.row_models import ExtractedRow
from app.validators.description_validator import DescriptionValidator
from app.validators.duplicate_validator import DuplicateValidator
from app.validators.quantity_validator import QuantityValidator
from app.validators.total_cost_validator import TotalCostValidator
from app.validators.unit_cost_validator import UnitCostValidator


def row(description="Paper", quantity="2", unit_cost="10", total="20") -> ExtractedRow:
    return ExtractedRow(source_file_id="f", source_file_name="file.xlsx", sheet_name="Items", excel_row_number=2,
        item_description=description, quantity=Decimal(quantity), unit_cost=Decimal(unit_cost), total_cost=Decimal(total))


def test_description_validator_is_strict_after_allowed_normalization() -> None:
    assert not DescriptionValidator().validate((row(" Paper\nA4 "), row("paper a4"), True))
    assert DescriptionValidator().validate((row("Paper A4"), row("Paper Letter"), True))[0].issue_type == "description_mismatch"


def test_quantity_validator() -> None: assert QuantityValidator().validate((row(), row(quantity="3")))[0].issue_type == "quantity_mismatch"
def test_unit_cost_validator() -> None: assert UnitCostValidator().validate((row(), row(unit_cost="11")))[0].issue_type == "wrong_unit_cost"
def test_total_cost_validator() -> None: assert TotalCostValidator().validate((row(total="21"), Decimal("20")))[0].issue_type == "wrong_total_cost"
def test_duplicate_validator() -> None: assert DuplicateValidator().validate([row(), row()])[0].issue_type == "duplicate_item"

