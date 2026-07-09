from pydantic import BaseModel


class SheetInfo(BaseModel):
    name: str
    row_count: int
    column_count: int
    detected_header_row: int
    headers: list[str]
    sample_rows: list[dict[str, object]]


class UploadedFile(BaseModel):
    id: str
    name: str
    extension: str
    size: int
    sheets: list[SheetInfo]
