from pathlib import Path

import openpyxl
import xlwt

from app.extractors.row_extractor import extract_rows
from app.models.template_models import ColumnMapping, MappingTemplate


def template() -> MappingTemplate:
    return MappingTemplate(name="Basic", included_sheets=["Items"], header_row=1, first_data_row=2,
        columns=ColumnMapping(item_number="No", description="Description", quantity="Qty", unit_cost="Unit Cost", total_cost="Total"))


def test_extracts_csv_rows_and_ignores_total(tmp_path: Path) -> None:
    path = tmp_path / "items.csv"
    path.write_text("No,Description,Qty,Unit Cost,Total\n1,Bond paper,2,50,100\n,Grand Total,,,100\n", encoding="utf-8")
    rows = extract_rows("id", path.name, path, template().model_copy(update={"included_sheets": ["CSV"]}))
    assert len(rows) == 1 and rows[0].excel_row_number == 2 and str(rows[0].quantity) == "2"


def test_extracts_xlsx_rows(tmp_path: Path) -> None:
    path = tmp_path / "items.xlsx"; book = openpyxl.Workbook(); sheet = book.active; sheet.title = "Items"
    sheet.append(["No", "Description", "Qty", "Unit Cost", "Total"]); sheet.append([1, "Printer ink", 3, 400, 1200]); book.save(path)
    assert extract_rows("id", path.name, path, template())[0].item_description == "Printer ink"


def test_extracts_legacy_xls_rows(tmp_path: Path) -> None:
    path = tmp_path / "items.xls"; book = xlwt.Workbook(); sheet = book.add_sheet("Items")
    for column, value in enumerate(["No", "Description", "Qty", "Unit Cost", "Total"]): sheet.write(0, column, value)
    for column, value in enumerate([1, "USB drive", 4, 250, 1000]): sheet.write(1, column, value)
    book.save(str(path))
    assert extract_rows("id", path.name, path, template())[0].item_description == "USB drive"

