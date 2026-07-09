from decimal import Decimal, InvalidOperation
import math
import re


def normalize_number(value: object) -> Decimal | None:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    text = re.sub(r"[^0-9.()\-]", "", str(value).strip().replace(",", ""))
    if not text:
        return None
    if text.startswith("(") and text.endswith(")"):
        text = f"-{text[1:-1]}"
    try:
        return Decimal(text)
    except InvalidOperation as error:
        raise ValueError(f"Invalid number: {value}") from error
