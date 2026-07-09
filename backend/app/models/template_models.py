from typing import Literal

from pydantic import BaseModel, Field, model_validator

FileRole = Literal["reference", "bidder", "abstract", "generic"]


class ColumnMapping(BaseModel):
    item_number: str | None = None
    quantity: str
    unit: str | None = None
    description: str
    unit_cost: str | None = None
    total_cost: str | None = None
    lot_group: str | None = None


class MappingTemplate(BaseModel):
    id: str | None = None
    name: str = Field(min_length=1, max_length=120)
    file_role: FileRole = "generic"
    included_sheets: list[str] = Field(default_factory=list)
    ignored_sheets: list[str] = Field(default_factory=list)
    sheet_pattern: str | None = None
    include_all_except_ignored: bool = False
    header_row: int = Field(default=1, ge=1, le=1000)
    first_data_row: int = Field(default=2, ge=1, le=1_000_000)
    columns: ColumnMapping
    ignored_terms: list[str] = Field(default_factory=list)
    case_insensitive: bool = True

    @model_validator(mode="after")
    def validate_rows(self) -> "MappingTemplate":
        if self.first_data_row <= self.header_row:
            raise ValueError("first_data_row must be after header_row")
        return self
