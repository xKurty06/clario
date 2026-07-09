import pandas as pd

from app.services.sheet_service import clean_headers, detect_header_index


def test_detects_procurement_header_below_document_titles() -> None:
    frame = pd.DataFrame([
        ["Republic of the Philippines", None, None, None],
        ["Abstract of Bids", None, None, None],
        [None, None, None, None],
        ["Item No", "Description", "Qty", "Unit Cost"],
        [1, "Bond paper", 4, 100],
    ])
    assert detect_header_index(frame) == 3


def test_cleans_blank_and_duplicate_headers() -> None:
    assert clean_headers(["Item", None, "Item", float("nan")]) == ["Item", "Column 2", "Item (2)", "Column 4"]

