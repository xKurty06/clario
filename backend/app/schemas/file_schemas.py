from pydantic import BaseModel

from app.models.row_models import ExtractedRow
from app.models.template_models import MappingTemplate


class PreviewRequest(BaseModel):
    file_id: str
    template: MappingTemplate


class PreviewResponse(BaseModel):
    rows: list[ExtractedRow]
    total: int


class HeaderInspectionRequest(BaseModel):
    file_id: str
    sheet_name: str
    header_row: int
