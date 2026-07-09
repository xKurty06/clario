from pathlib import Path

import pandas as pd


def detect_sheet_names(path: Path) -> list[str]:
    if path.suffix.lower() == ".csv":
        return ["CSV"]
    return list(pd.ExcelFile(path).sheet_names)
