from pydantic import BaseModel

from app.models.comparison_models import ComparisonDataSource


class DataSourcePreviewRequest(BaseModel):
    data_source: ComparisonDataSource


class HeaderInspectionRequest(BaseModel):
    file_id: str
    sheet_name: str
    header_row: int

