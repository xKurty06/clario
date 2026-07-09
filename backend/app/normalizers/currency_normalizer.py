from decimal import Decimal

from app.normalizers.number_normalizer import normalize_number


def normalize_currency(value: object) -> Decimal | None:
    return normalize_number(value)
