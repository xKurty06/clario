from pathlib import Path

import openpyxl
from fastapi.testclient import TestClient

from app.main import app
from app.services import file_service, sheet_service


def register_file(file_id: str, path: Path) -> None:
    file_service._files[file_id] = (path.name, path, path.stat().st_size)


def make_preview_workbook(path: Path) -> None:
    book = openpyxl.Workbook()
    sheet = book.active
    sheet.title = "Items"
    sheet.append(["Item Number", "Description", "Quantity"])
    sheet.append(["1", "Bond Paper", 2])
    book.save(path)


def preview_payload(file_id: str, file_name: str) -> dict[str, object]:
    return {
        "data_source": {
            "id": "source-1",
            "name": "Items source",
            "file_id": file_id,
            "file_name": file_name,
            "sheet_name": "Items",
            "header_row": 1,
            "first_data_row": 2,
            "selected_row_numbers": [],
            "ignored_row_numbers": [],
            "row_selection_mode": "auto_detected",
            "fields": [],
        }
    }


def test_data_source_preview_route_returns_preview(tmp_path: Path) -> None:
    path = tmp_path / "preview.xlsx"
    make_preview_workbook(path)
    register_file("file-1", path)

    response = TestClient(app).post(
        "/api/v1/files/data-source-preview",
        json=preview_payload("file-1", "preview.xlsx"),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["data_source"]["selected_row_numbers"] == [2]
    assert body["columns"][1]["letter"] == "B"
    assert body["rows"][0]["cells"]["Description"] == "Bond Paper"


def test_data_source_preview_keeps_uploaded_display_name(tmp_path: Path) -> None:
    path = tmp_path / "abc123.xlsx"
    make_preview_workbook(path)
    register_file("file-1", path)

    response = TestClient(app).post(
        "/api/v1/files/data-source-preview",
        json=preview_payload("file-1", "original-upload-name.xlsx"),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["data_source"]["file_name"] == "original-upload-name.xlsx"


def test_inspect_sheets_returns_fast_basic_metadata(tmp_path: Path) -> None:
    path = tmp_path / "multi-sheet.xlsx"
    book = openpyxl.Workbook()
    first = book.active
    first.title = "Cover"
    first.append(["Document title"])
    first.append(["Item No", "Description", "Qty"])
    first.append([1, "Bond Paper", 2])
    second = book.create_sheet("Other")
    second.append(["Header A", "Header B"])
    book.save(path)

    sheets = sheet_service.inspect_sheets(path)

    assert [sheet.name for sheet in sheets] == ["Cover", "Other"]
    assert sheets[0].detected_header_row == 2
    assert sheets[0].headers == []
    assert sheets[0].sample_rows == []


def test_get_file_recovers_persisted_upload_metadata(tmp_path: Path, monkeypatch) -> None:
    upload_dir = tmp_path / "working-files"
    upload_dir.mkdir()
    path = upload_dir / "abc123.xlsx"
    make_preview_workbook(path)

    monkeypatch.setattr(file_service.get_settings(), "data_directory", tmp_path)
    file_service._files.clear()
    file_service._write_file_metadata("abc123", "original.xlsx", path, path.stat().st_size)
    file_service._files.clear()

    name, recovered_path, size = file_service.get_file("abc123")

    assert name == "original.xlsx"
    assert recovered_path == path
    assert size == path.stat().st_size


def test_get_file_recovers_existing_disk_file_without_metadata(tmp_path: Path, monkeypatch) -> None:
    upload_dir = tmp_path / "working-files"
    upload_dir.mkdir()
    path = upload_dir / "abc123.xlsx"
    make_preview_workbook(path)

    monkeypatch.setattr(file_service.get_settings(), "data_directory", tmp_path)
    file_service._files.clear()

    name, recovered_path, size = file_service.get_file("abc123")

    assert name == "abc123.xlsx"
    assert recovered_path == path
    assert size == path.stat().st_size
