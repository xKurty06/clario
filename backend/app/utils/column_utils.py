import re


def suggest_columns(headers: list[str], sample_rows: list[dict[str, object]]) -> dict[str, list[dict[str, object]]]:
    aliases = {
        "description": ("description", "item description", "specification", "particulars", "article"),
        "quantity": ("qty", "quantity"),
        "unit": ("unit", "uom"),
        "item_number": ("item no", "item number", "no."),
        "unit_cost": ("unit cost", "unit price", "price"),
        "total_cost": ("total cost", "total amount", "amount", "extended"),
        "lot_group": ("lot", "group"),
    }
    result: dict[str, list[dict[str, object]]] = {}
    for field, terms in aliases.items():
        candidates = []
        for position, header in enumerate(headers):
            lowered = header.casefold().strip()
            score = 0.0
            reasons = []
            if lowered in terms:
                score += 0.9; reasons.append("exact header match")
            elif any(term in lowered for term in terms):
                score += 0.7; reasons.append("header keyword")
            values = [str(row.get(header) or "") for row in sample_rows]
            numeric_ratio = sum(bool(re.fullmatch(r"[\s$₱€£,()0-9.\-]+", value)) for value in values if value) / max(1, sum(bool(v) for v in values))
            if field in {"quantity", "unit_cost", "total_cost"} and numeric_ratio > 0.6:
                score += 0.2; reasons.append("mostly numeric values")
            if field == "description" and values and sum(len(v) for v in values) / max(1, len(values)) > 18:
                score += 0.2; reasons.append("long text values")
            if score:
                candidates.append({"column": header, "confidence": min(score, 1.0), "reasons": reasons, "position": position})
        result[field] = sorted(candidates, key=lambda item: (-float(item["confidence"]), int(item["position"])))[:3]
    return result
