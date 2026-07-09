from pathlib import Path

import pandas as pd

from app.extractors.base_extractor import BaseExtractor


class CsvExtractor(BaseExtractor[dict[str, pd.DataFrame]]):
    def supports(self, path: Path) -> bool:
        return path.suffix.lower() == ".csv"

    def extract(self, path: Path) -> dict[str, pd.DataFrame]:
        try:
            frame = pd.read_csv(path, header=None, dtype=object, encoding="utf-8-sig")
        except UnicodeDecodeError:
            frame = pd.read_csv(path, header=None, dtype=object, encoding="latin-1")
        return {"CSV": frame}
