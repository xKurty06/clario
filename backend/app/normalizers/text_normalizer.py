import re


def normalize_text(value: object, case_insensitive: bool = False) -> str:
    if value is None:
        return ""
    text = re.sub(r"\s+", " ", str(value).replace("\r", " ").replace("\n", " ")).strip()
    return text.casefold() if case_insensitive else text
