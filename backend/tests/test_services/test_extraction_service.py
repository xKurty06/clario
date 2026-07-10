from pathlib import Path

import openpyxl

from app.models.comparison_models import ComparisonDataSource, ComparisonField
from app.services import file_service
from app.services.extraction_service import extract_records, preview_data_source


def register_file(file_id: str, path: Path) -> None:
    file_service._files[file_id] = (path.name, path, path.stat().st_size)


def test_preview_and_extraction_respect_selected_and_ignored_rows(tmp_path: Path) -> None:
    path = tmp_path / "rows.xlsx"
    book = openpyxl.Workbook()
    sheet = book.active
    sheet.title = "Items"
    sheet.append(["Item Number", "Description", "Quantity"])
    sheet.append(["1", "Bond Paper", 2])
    sheet.append(["2", "Notebook", 5])
    sheet.append(["3", "Marker", 7])
    book.save(path)
    register_file("file-1", path)

    source = ComparisonDataSource(
        id="source-1",
        name="Items source",
        file_id="file-1",
        sheet_name="Items",
        header_row=1,
        first_data_row=2,
        selected_row_numbers=[2, 3, 4],
        ignored_row_numbers=[3],
        fields=[
            ComparisonField(id="field-description", data_source_id="source-1", field_name="Description", field_type="text", column_letter="B"),
            ComparisonField(id="field-quantity", data_source_id="source-1", field_name="Quantity", field_type="number", column_letter="C"),
        ],
    )

    preview = preview_data_source(source)
    records = extract_records(source)

    assert preview.columns[1].letter == "B"
    assert [record.excel_row_number for record in records] == [2, 4]
    assert records[0].field_values["field-description"].raw_value == "Bond Paper"
    assert str(records[1].field_values["field-quantity"].normalized_value) == "7"
