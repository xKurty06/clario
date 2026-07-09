from pathlib import Path

import pandas as pd

from app.extractors.csv_extractor import CsvExtractor
from app.extractors.excel_extractor import ExcelExtractor
from app.models.file_models import SheetInfo
from app.normalizers.text_normalizer import normalize_text

HEADER_TERMS = ("item", "description", "particular", "specification", "qty", "quantity", "unit", "cost", "price", "amount", "total")


def clean_headers(values: list[object]) -> list[str]:
    headers: list[str] = []
    counts: dict[str, int] = {}
    for index, value in enumerate(values):
        base = f"Column {index + 1}" if pd.isna(value) else normalize_text(value)
        if not base or base.casefold() == "nan":
            base = f"Column {index + 1}"
        count = counts.get(base.casefold(), 0) + 1
        counts[base.casefold()] = count
        headers.append(base if count == 1 else f"{base} ({count})")
    return headers


def _merged_ranges(path: Path, sheet_name: str) -> list[tuple[int, int, int, int]]:
    """Return zero-based, end-exclusive merged ranges."""
    if path.suffix.lower() == ".xls":
        import xlrd
        workbook = xlrd.open_workbook(path, formatting_info=True)
        return list(workbook.sheet_by_name(sheet_name).merged_cells)
    if path.suffix.lower() == ".xlsx":
        import openpyxl
        worksheet = openpyxl.load_workbook(path, read_only=False, data_only=True)[sheet_name]
        return [(cell.min_row - 1, cell.max_row, cell.min_col - 1, cell.max_col) for cell in worksheet.merged_cells.ranges]
    return []


def composite_headers(path: Path, sheet_name: str, frame: pd.DataFrame, header_row: int) -> list[str]:
    """Combine split and merged headings ending at the user-selected header row."""
    end_index = header_row - 1
    if end_index < 0 or end_index >= len(frame):
        raise ValueError("Header row is outside the worksheet")
    ranges = _merged_ranges(path, sheet_name)
    starts = [row_start for row_start, row_end, _, _ in ranges if row_start <= end_index < row_end]
    start_index = min(starts) if starts else end_index
    # Limit accidental inclusion of document titles while allowing common 2-5 row headers.
    start_index = max(start_index, end_index - 5)
    matrix = frame.iloc[start_index:end_index + 1].copy()
    for row_start, row_end, col_start, col_end in ranges:
        if row_end <= start_index or row_start > end_index:
            continue
        anchor = frame.iat[row_start, col_start]
        for row in range(max(row_start, start_index), min(row_end, end_index + 1)):
            for column in range(col_start, min(col_end, len(frame.columns))):
                matrix.iat[row - start_index, column] = anchor
    combined: list[str] = []
    for column in range(len(frame.columns)):
        parts: list[str] = []
        for value in matrix.iloc[:, column].tolist():
            if pd.isna(value):
                continue
            text = normalize_text(value)
            if text and text.casefold() != "nan" and text.casefold() not in {part.casefold() for part in parts}:
                parts.append(text)
        combined.append(" / ".join(parts) if parts else f"Column {column + 1}")
    return clean_headers(combined)


def detect_header_index(frame: pd.DataFrame) -> int:
    if frame.empty:
        return 0
    best_index, best_score = 0, -1
    for index in range(min(len(frame), 60)):
        values = [normalize_text(value, True) for value in frame.iloc[index].tolist() if not pd.isna(value)]
        non_empty = len(values)
        keyword_hits = sum(any(term in value for term in HEADER_TERMS) for value in values)
        distinct_hits = len({term for term in HEADER_TERMS if any(term in value for value in values)})
        score = keyword_hits * 4 + distinct_hits * 2 + min(non_empty, 8)
        if non_empty >= 2 and score > best_score:
            best_index, best_score = index, score
    return best_index


def inspect_header(path: Path, sheet_name: str, header_row: int) -> tuple[list[str], list[dict[str, object]]]:
    frames = CsvExtractor().extract(path) if path.suffix.lower() == ".csv" else ExcelExtractor().extract(path)
    if sheet_name not in frames:
        raise ValueError("Sheet not found")
    frame = frames[sheet_name]
    index = header_row - 1
    if index < 0 or index >= len(frame):
        raise ValueError("Header row is outside the worksheet")
    headers = composite_headers(path, sheet_name, frame, header_row)
    samples = [{headers[i]: (None if pd.isna(value) else str(value)) for i, value in enumerate(row.tolist())} for _, row in frame.iloc[index + 1:index + 6].iterrows()]
    return headers, samples


def inspect_sheets(path: Path) -> list[SheetInfo]:
    frames = CsvExtractor().extract(path) if path.suffix.lower() == ".csv" else ExcelExtractor().extract(path)
    result: list[SheetInfo] = []
    for name, frame in frames.items():
        first_non_empty = detect_header_index(frame)
        headers = composite_headers(path, name, frame, first_non_empty + 1) if len(frame) else []
        samples = []
        for _, row in frame.iloc[first_non_empty + 1:first_non_empty + 6].iterrows():
            samples.append({headers[i]: (None if pd.isna(v) else str(v)) for i, v in enumerate(row.tolist())})
        result.append(SheetInfo(name=name, row_count=len(frame), column_count=len(frame.columns), detected_header_row=first_non_empty + 1, headers=headers, sample_rows=samples))
    return result
