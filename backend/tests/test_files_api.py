from pathlib import Path

import openpyxl
from fastapi.testclient import TestClient

from app.main import app
from app.services import file_service


def register_file(file_id: str, path: Path) -> None:
    file_service._files[file_id] = (path.name, path, path.stat().st_size)


def test_data_source_preview_route_returns_preview(tmp_path: Path) -> None:
    path = tmp_path / "preview.xlsx"
    book = openpyxl.Workbook()
    sheet = book.active
    sheet.title = "Items"
    sheet.append(["Item Number", "Description", "Quantity"])
    sheet.append(["1", "Bond Paper", 2])
    book.save(path)
    register_file("file-1", path)

    response = TestClient(app).post(
        "/api/v1/files/data-source-preview",
        json={
            "data_source": {
                "id": "source-1",
                "name": "Items source",
                "file_id": "file-1",
                "file_name": "preview.xlsx",
                "sheet_name": "Items",
                "header_row": 1,
                "first_data_row": 2,
                "selected_row_numbers": [],
                "ignored_row_numbers": [],
                "row_selection_mode": "auto_detected",
                "fields": [],
            }
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["data_source"]["selected_row_numbers"] == [2]
    assert body["columns"][1]["letter"] == "B"
    assert body["rows"][0]["cells"]["Description"] == "Bond Paper"
