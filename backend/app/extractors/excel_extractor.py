from pathlib import Path

import pandas as pd

from app.extractors.base_extractor import BaseExtractor


class ExcelExtractor(BaseExtractor[dict[str, pd.DataFrame]]):
    def supports(self, path: Path) -> bool:
        return path.suffix.lower() in {".xlsx", ".xls"}

    def extract(self, path: Path) -> dict[str, pd.DataFrame]:
        workbook = pd.ExcelFile(path)
        return {name: pd.read_excel(path, sheet_name=name, header=None, dtype=object) for name in workbook.sheet_names}
