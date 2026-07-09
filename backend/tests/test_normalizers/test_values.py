from decimal import Decimal

import pytest

from app.normalizers.number_normalizer import normalize_number
from app.normalizers.text_normalizer import normalize_text


def test_text_normalizer_collapses_whitespace_and_case() -> None:
    assert normalize_text("  Heavy\n Duty   Paper ", True) == "heavy duty paper"


@pytest.mark.parametrize(("raw", "expected"), [("₱1,250.50", Decimal("1250.50")), ("(25)", Decimal("-25")), (None, None)])
def test_number_normalizer(raw: object, expected: Decimal | None) -> None:
    assert normalize_number(raw) == expected

