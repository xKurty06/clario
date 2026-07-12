from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import pandas as pd

from app.extractors.csv_extractor import CsvExtractor
from app.extractors.excel_extractor import ExcelExtractor
from app.models.comparison_models import (
    ColumnReference,
    ComparisonDataSource,
    ComparisonField,
    DataSourcePreview,
    ExtractedFieldValue,
    ExtractedRecord,
    PreviewRow,
)
from app.normalizers.currency_normalizer import normalize_currency
from app.normalizers.number_normalizer import normalize_number
from app.normalizers.text_normalizer import normalize_text
from app.services.file_service import get_file
from app.services.sheet_service import composite_headers

_INTERNAL_WORKING_FILE_PATTERN = re.compile(r"^[0-9a-f]{32}\.[A-Za-z0-9]+$", re.IGNORECASE)


def _load_frame(path: Path, sheet_name: str) -> pd.DataFrame:
    frames = CsvExtractor().extract(path) if path.suffix.lower() == ".csv" else ExcelExtractor().extract(path)
    try:
        return frames[sheet_name]
    except KeyError as error:
        raise ValueError(f"Sheet '{sheet_name}' was not found.") from error


def _column_letter(index: int) -> str:
    value = index + 1
    letters: list[str] = []
    while value:
        value, remainder = divmod(value - 1, 26)
        letters.append(chr(65 + remainder))
    return "".join(reversed(letters))


def _column_index(letter: str) -> int:
    result = 0
    for character in letter.strip().upper():
        if not "A" <= character <= "Z":
            raise ValueError(f"Invalid column letter: {letter}")
        result = result * 26 + (ord(character) - 64)
    return result - 1


def _columns(headers: list[str]) -> list[ColumnReference]:
    return [
        ColumnReference(
            index=index,
            letter=_column_letter(index),
            header_label=header,
            display_label=f"{_column_letter(index)} -- {header}",
        )
        for index, header in enumerate(headers)
    ]


def _display_file_name(data_source: ComparisonDataSource, recovered_file_name: str) -> str:
    """Prefer the user-facing uploaded name over the internal working-file name."""
    current_name = data_source.file_name or ""
    if current_name and not _INTERNAL_WORKING_FILE_PATTERN.fullmatch(current_name):
        return current_name
    return recovered_file_name


def _normalize_value(value: Any, field: ComparisonField) -> Any:
    field_type = field.field_type
    if field_type == "text":
        return normalize_text(value, field.normalization.case_insensitive)
    if field_type == "number":
        return normalize_number(value)
    if field_type == "currency":
        return normalize_currency(value)
    if field_type == "boolean":
        text = normalize_text(value, True)
        if not text:
            return None
        return text in {"true", "yes", "y", "1", "checked"}
    if field_type == "date":
        text = normalize_text(value)
        return text or None
    return value


def _auto_selected_rows(frame: pd.DataFrame, headers: list[str], data_source: ComparisonDataSource) -> list[int]:
    selected: list[int] = []
    for row_index in range(data_source.first_data_row - 1, len(frame)):
        row_number = row_index + 1
        if row_number in data_source.ignored_row_numbers:
            continue
        values = frame.iloc[row_index].tolist()
        has_value = any(not pd.isna(value) and normalize_text(value) for value in values)
        if not has_value:
            continue
        header_like = " / ".join(normalize_text(value, True) for value in values if not pd.isna(value))
        if header_like and any(header.casefold() in header_like for header in headers if header):
            continue
        selected.append(row_number)
    return selected


def _boundary_ignored_rows(data_source: ComparisonDataSource) -> set[int]:
    return {row_number for row_number in range(1, data_source.first_data_row) if row_number != data_source.header_row}


def _preview_start_row(data_source: ComparisonDataSource) -> int:
    # Row setup is a visual review step, so always include the top of the sheet.
    # This lets users see titles, blank rows, merged-header text, and row 1 without opening Excel.
    return 1


def preview_data_source(data_source: ComparisonDataSource) -> DataSourcePreview:
    recovered_file_name, path, _ = get_file(data_source.file_id)
    display_file_name = _display_file_name(data_source, recovered_file_name)
    frame = _load_frame(path, data_source.sheet_name)
    headers = composite_headers(path, data_source.sheet_name, frame, data_source.header_row)
    boundary_ignored_rows = _boundary_ignored_rows(data_source)
    candidate_selected_rows = set(data_source.selected_row_numbers or _auto_selected_rows(frame, headers, data_source))
    selected_rows = {row_number for row_number in candidate_selected_rows if row_number >= data_source.first_data_row}
    ignored_rows = set(data_source.ignored_row_numbers) | boundary_ignored_rows
    rows: list[PreviewRow] = []
    start_index = _preview_start_row(data_source) - 1
    for row_index in range(start_index, len(frame)):
        row_number = row_index + 1
        row_values = frame.iloc[row_index].tolist()
        cells = {headers[index]: (None if pd.isna(value) else value) for index, value in enumerate(row_values)}
        rows.append(
            PreviewRow(
                row_number=row_number,
                selected=row_number in selected_rows,
                ignored=row_number in ignored_rows,
                cells=cells,
            )
        )
    source = data_source.model_copy(
        update={
            "file_name": display_file_name,
            "selected_row_numbers": sorted(selected_rows),
            "ignored_row_numbers": sorted(ignored_rows),
        }
    )
    return DataSourcePreview(
        data_source=source,
        columns=_columns(headers),
        rows=rows,
        total_rows=len(frame),
        detected_selected_rows=sorted(selected_rows),
    )


def extract_records(data_source: ComparisonDataSource) -> list[ExtractedRecord]:
    preview = preview_data_source(data_source)
    selected = set(preview.data_source.selected_row_numbers)
    ignored = set(preview.data_source.ignored_row_numbers)
    file_name = preview.data_source.file_name or get_file(data_source.file_id)[0]
    records: list[ExtractedRecord] = []
    field_by_id = {field.id: field for field in preview.data_source.fields}
    header_lookup = {column.letter: column.header_label for column in preview.columns}

    for row in preview.rows:
        if row.row_number in ignored or row.row_number not in selected:
            continue
        issues: list[str] = []
        field_values: dict[str, ExtractedFieldValue] = {}
        for field in preview.data_source.fields:
            header_label = header_lookup.get(field.column_letter.upper())
            raw_value = row.cells.get(header_label) if header_label else None
            try:
                normalized_value = _normalize_value(raw_value, field)
            except ValueError:
                normalized_value = None
                issues.append(f"Invalid {field.field_type} value for {field.display_name}.")
            field_values[field.id] = ExtractedFieldValue(
                field_id=field.id,
                field_name=field.field_name,
                display_name=field.display_name,
                field_type=field.field_type,
                column_letter=field.column_letter.upper(),
                original_header_label=field.original_header_label or header_label,
                raw_value=raw_value,
                normalized_value=normalized_value,
            )
            if field.required and (normalized_value is None or normalized_value == ""):
                issues.append(f"Required field {field.display_name} is blank.")

        records.append(
            ExtractedRecord(
                source_file_id=data_source.file_id,
                source_file_name=file_name,
                data_source_id=data_source.id,
                data_source_name=data_source.name,
                sheet_name=data_source.sheet_name,
                excel_row_number=row.row_number,
                field_values=field_values,
                raw_row=row.cells,
                extraction_issues=issues,
            )
        )
    return records


def get_field(data_sources: list[ComparisonDataSource], field_id: str) -> ComparisonField:
    for data_source in data_sources:
        for field in data_source.fields:
            if field.id == field_id:
                return field
    raise ValueError(f"Field {field_id} was not found.")


def get_field_value(record: ExtractedRecord, field_id: str) -> ExtractedFieldValue | None:
    return record.field_values.get(field_id)
