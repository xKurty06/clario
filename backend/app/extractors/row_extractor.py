import re
from pathlib import Path

import pandas as pd

from app.config.constants import DEFAULT_IGNORED_TERMS
from app.extractors.csv_extractor import CsvExtractor
from app.extractors.excel_extractor import ExcelExtractor
from app.models.row_models import ExtractedRow
from app.models.template_models import MappingTemplate
from app.normalizers.number_normalizer import normalize_number
from app.normalizers.text_normalizer import normalize_text
from app.services.sheet_service import composite_headers


def _selected_sheets(frames: dict[str, pd.DataFrame], template: MappingTemplate) -> list[str]:
    names = list(frames)
    ignored = {name.casefold() for name in template.ignored_sheets}
    if template.include_all_except_ignored:
        return [name for name in names if name.casefold() not in ignored]
    if template.sheet_pattern:
        pattern = re.compile(template.sheet_pattern, re.IGNORECASE)
        return [name for name in names if pattern.search(name) and name.casefold() not in ignored]
    if template.included_sheets:
        requested = {name.casefold() for name in template.included_sheets}
        return [name for name in names if name.casefold() in requested and name.casefold() not in ignored]
    return [names[0]] if names else []


def extract_rows(file_id: str, file_name: str, path: Path, template: MappingTemplate) -> list[ExtractedRow]:
    adapter = CsvExtractor() if path.suffix.lower() == ".csv" else ExcelExtractor()
    frames = adapter.extract(path)
    rows: list[ExtractedRow] = []
    ignored_terms = tuple(term.casefold() for term in (template.ignored_terms or DEFAULT_IGNORED_TERMS))
    for sheet in _selected_sheets(frames, template):
        frame = frames[sheet]
        header_index = template.header_row - 1
        if header_index >= len(frame):
            continue
        headers = composite_headers(path, sheet, frame, template.header_row)
        data_start = template.first_data_row - 1
        for index in range(data_start, len(frame)):
            raw_list = frame.iloc[index].tolist()
            raw = {headers[i]: (None if pd.isna(value) else value) for i, value in enumerate(raw_list)}
            description = normalize_text(raw.get(template.columns.description))
            if not description or any(term in description.casefold() for term in ignored_terms):
                continue
            issues: list[str] = []
            try:
                quantity = normalize_number(raw.get(template.columns.quantity))
            except ValueError:
                quantity = None
                issues.append("invalid quantity format")
            def optional_number(column: str | None, label: str):
                if not column:
                    return None
                try:
                    return normalize_number(raw.get(column))
                except ValueError:
                    issues.append(f"invalid {label} format")
                    return None
            unit_cost = optional_number(template.columns.unit_cost, "unit cost")
            total_cost = optional_number(template.columns.total_cost, "total cost")
            rows.append(ExtractedRow(
                source_file_id=file_id, source_file_name=file_name, sheet_name=sheet,
                excel_row_number=index + 1,
                item_number=normalize_text(raw.get(template.columns.item_number)) or None if template.columns.item_number else None,
                quantity=quantity,
                unit=normalize_text(raw.get(template.columns.unit)) or None if template.columns.unit else None,
                item_description=description,
                unit_cost=unit_cost, total_cost=total_cost,
                lot_group=normalize_text(raw.get(template.columns.lot_group)) or None if template.columns.lot_group else None,
                raw_values=raw,
                normalized_values={"description": normalize_text(description, template.case_insensitive), "quantity": quantity, "unit_cost": unit_cost, "total_cost": total_cost},
                extraction_issues=issues,
            ))
    return rows
