from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field


class ExtractedRow(BaseModel):
    source_file_id: str
    source_file_name: str
    sheet_name: str
    excel_row_number: int
    item_number: str | None = None
    quantity: Decimal | None = None
    unit: str | None = None
    item_description: str
    unit_cost: Decimal | None = None
    total_cost: Decimal | None = None
    lot_group: str | None = None
    raw_values: dict[str, Any] = Field(default_factory=dict)
    normalized_values: dict[str, Any] = Field(default_factory=dict)
    extraction_issues: list[str] = Field(default_factory=list)
