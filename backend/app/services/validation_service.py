from __future__ import annotations

import re
from collections import Counter
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from uuid import uuid4

from app.models.comparison_models import (
    ComparisonDataSource,
    ComparisonRule,
    ExtractedFieldValue,
    ExtractedRecord,
    FieldType,
    RuleDiscrepancy,
    RuleSummary,
    ValidationRequest,
    ValidationResult,
)
from app.services.extraction_service import extract_records, get_field, get_field_value
from app.normalizers.text_normalizer import normalize_text


_MATCH_STRATEGY_LABELS = {
    "by_row_order": "row order",
    "by_item_number_field": "item number",
    "by_exact_text_field": "exact text",
    "by_multiple_fields": "multiple match fields",
    "manual_placeholder": "manual placeholder",
}

_STRICTNESS_LABELS = {
    "exact": "exact matching",
    "normalized_exact": "normalized exact matching",
    "numeric_tolerance": "numeric tolerance matching",
    "currency_tolerance": "currency tolerance matching",
}


def _stringify(value: object) -> str | None:
    if value is None:
        return None
    return str(value)


def _value_text(value: object) -> str:
    return "" if value is None else str(value).strip()


def _decimal_or_none(value: object) -> Decimal | None:
    text = _value_text(value)
    if not text:
        return None
    cleaned = text.replace(",", "").replace("₱", "").replace("PHP", "").strip()
    try:
        return Decimal(cleaned)
    except (InvalidOperation, ValueError):
        return None


def _alpha_numeric_signature(value: object) -> str:
    return re.sub(r"[^a-z0-9]+", "", _value_text(value).lower())


def _compact_text(value: object) -> str:
    return re.sub(r"\s+", " ", _value_text(value)).strip()


def _friendly_match_strategy(rule: ComparisonRule) -> str:
    return _MATCH_STRATEGY_LABELS.get(rule.match_strategy, rule.match_strategy.replace("_", " "))


def _friendly_strictness(rule: ComparisonRule) -> str:
    return _STRICTNESS_LABELS.get(rule.strictness, rule.strictness.replace("_", " "))


def _comparison_guidance(
    left_value: ExtractedFieldValue,
    right_value: ExtractedFieldValue,
    rule: ComparisonRule,
    field_type: FieldType,
) -> tuple[str, str]:
    expected = left_value.raw_value
    actual = right_value.raw_value
    expected_text = _value_text(expected)
    actual_text = _value_text(actual)
    expected_field = left_value.display_name
    actual_field = right_value.display_name
    match_note = f"Rows were paired by {_friendly_match_strategy(rule)} using {_friendly_strictness(rule)}."

    if not expected_text and actual_text:
        return (
            f"Review {actual_field}; the trusted {expected_field} is blank while the actual side has a value.",
            f"Unexpected actual value. {match_note}",
        )

    if expected_text and not actual_text:
        return (
            f"Fill in {actual_field} or verify that this row should be included.",
            f"Actual value is blank while trusted {expected_field} has data. {match_note}",
        )

    expected_number = _decimal_or_none(expected)
    actual_number = _decimal_or_none(actual)
    if expected_number is not None and actual_number is not None and expected_number != actual_number:
        difference = actual_number - expected_number
        direction = "higher" if difference > 0 else "lower"
        return (
            f"Review {actual_field}; expected {expected_text}, found {actual_text}.",
            f"Actual value is {direction} by {abs(difference)}. {match_note}",
        )

    if field_type == "text" or expected_text or actual_text:
        expected_compact = _compact_text(expected)
        actual_compact = _compact_text(actual)
        expected_case = expected_compact.lower()
        actual_case = actual_compact.lower()
        expected_signature = _alpha_numeric_signature(expected)
        actual_signature = _alpha_numeric_signature(actual)

        if expected_case == actual_case and expected_compact != actual_compact:
            return (
                f"Review capitalization or extra spacing in {actual_field}.",
                f"The wording appears the same after ignoring capitalization or extra spaces. {match_note}",
            )

        if expected_signature and expected_signature == actual_signature:
            return (
                f"Review punctuation, spacing, symbols, or unit formatting in {actual_field}.",
                f"Formatting-only difference: the letters and numbers match, but the written format differs. {match_note}",
            )

        return (
            f"Review {actual_field} against the trusted {expected_field}.",
            f"Text content differs. Check wording, units, item variant, model details, or spelling. {match_note}",
        )

    return (
        f"Review {actual_field} against {expected_field}.",
        f"Values do not match. {match_note}",
    )


def _compare_values(left: object, right: object, rule: ComparisonRule, field_type: FieldType) -> bool:
    if left is None and right is None:
        return True
    if rule.strictness == "exact":
        return left == right
    if rule.strictness == "normalized_exact":
        if field_type == "text":
            return normalize_text(left, True) == normalize_text(right, True)
        return left == right
    if rule.strictness == "numeric_tolerance":
        if left is None or right is None:
            return False
        tolerance = rule.numeric_tolerance or Decimal("0")
        return abs(Decimal(left) - Decimal(right)) <= tolerance
    if rule.strictness == "currency_tolerance":
        if left is None or right is None:
            return False
        tolerance = rule.currency_tolerance or Decimal("0")
        return abs(Decimal(left) - Decimal(right)) <= tolerance
    return left == right


def _key_for_record(record: ExtractedRecord, field_ids: list[str]) -> tuple[str, ...]:
    values: list[str] = []
    for field_id in field_ids:
        field_value = get_field_value(record, field_id)
        values.append(normalize_text(field_value.normalized_value if field_value else "", True))
    return tuple(values)


def _match_field_ids(rule: ComparisonRule, side: str) -> list[str]:
    if side == "left":
        return rule.left_match_field_ids or ([rule.left_field_id] if rule.left_field_id else [])
    return rule.right_match_field_ids or ([rule.right_field_id] if rule.right_field_id else [])


def _has_blank_match_key(record: ExtractedRecord, field_ids: list[str]) -> bool:
    key = _key_for_record(record, field_ids)
    return bool(field_ids) and any(not value for value in key)


def _format_match_key(record: ExtractedRecord, field_ids: list[str]) -> str:
    values: list[str] = []
    for field_id in field_ids:
        field_value = get_field_value(record, field_id)
        values.append(_stringify(field_value.raw_value if field_value else None) or "")
    return " / ".join(values) or "-"


def _matched_pairs(
    left_records: list[ExtractedRecord],
    right_records: list[ExtractedRecord],
    rule: ComparisonRule,
) -> list[tuple[ExtractedRecord | None, ExtractedRecord | None]]:
    if rule.match_strategy == "by_row_order":
        size = max(len(left_records), len(right_records))
        return [
            (left_records[index] if index < len(left_records) else None, right_records[index] if index < len(right_records) else None)
            for index in range(size)
        ]

    left_keys = rule.left_match_field_ids or ([rule.left_field_id] if rule.left_field_id else [])
    right_keys = rule.right_match_field_ids or ([rule.right_field_id] if rule.right_field_id else [])
    remaining = list(right_records)
    pairs: list[tuple[ExtractedRecord | None, ExtractedRecord | None]] = []
    for left_record in left_records:
        left_key = _key_for_record(left_record, left_keys)
        match_index = next(
            (
                index
                for index, candidate in enumerate(remaining)
                if _key_for_record(candidate, right_keys) == left_key
            ),
            None,
        )
        if match_index is None:
            pairs.append((left_record, None))
            continue
        pairs.append((left_record, remaining.pop(match_index)))
    pairs.extend((None, record) for record in remaining)
    return pairs


def _data_source_map(data_sources: list[ComparisonDataSource]) -> dict[str, ComparisonDataSource]:
    return {data_source.id: data_source for data_source in data_sources}


def _source_file_name(data_source: ComparisonDataSource | None) -> str | None:
    if not data_source:
        return None
    return data_source.file_name or data_source.name


def _rule_records(records: list[ExtractedRecord], data_source_id: str | None) -> list[ExtractedRecord]:
    if not data_source_id:
        return []
    return [record for record in records if record.data_source_id == data_source_id]


def _compare_rule(
    rule: ComparisonRule,
    data_sources: list[ComparisonDataSource],
    records: list[ExtractedRecord],
) -> list[RuleDiscrepancy]:
    left_records = _rule_records(records, rule.left_data_source_id)
    right_records = _rule_records(records, rule.right_data_source_id)
    left_field = get_field(data_sources, rule.left_field_id) if rule.left_field_id else None
    right_field = get_field(data_sources, rule.right_field_id) if rule.right_field_id else None
    sources_by_id = _data_source_map(data_sources)
    left_source = sources_by_id.get(rule.left_data_source_id or "")
    right_source = sources_by_id.get(rule.right_data_source_id or "")
    discrepancies: list[RuleDiscrepancy] = []
    pairs = _matched_pairs(left_records, right_records, rule)
    left_match_fields = _match_field_ids(rule, "left")
    right_match_fields = _match_field_ids(rule, "right")
    skipped_pair_indexes: set[int] = set()

    left_only = [(index, left_record) for index, (left_record, right_record) in enumerate(pairs) if left_record and not right_record]
    right_only = [(index, right_record) for index, (left_record, right_record) in enumerate(pairs) if right_record and not left_record]
    used_right_indexes: set[int] = set()
    for left_index, left_record in left_only:
        if _has_blank_match_key(left_record, left_match_fields):
            continue
        match = next(
            (
                (right_index, right_record)
                for right_index, right_record in right_only
                if right_index not in used_right_indexes
                and right_record.excel_row_number == left_record.excel_row_number
                and not _has_blank_match_key(right_record, right_match_fields)
            ),
            None,
        )
        if not match:
            continue
        right_index, right_record = match
        skipped_pair_indexes.update({left_index, right_index})
        used_right_indexes.add(right_index)
        discrepancies.append(
            RuleDiscrepancy(
                rule_id=rule.id,
                rule_name=rule.rule_name,
                rule_type=rule.rule_type,
                severity=rule.severity,
                left_file_name=left_record.source_file_name,
                left_sheet_name=left_record.sheet_name,
                left_row_number=left_record.excel_row_number,
                right_file_name=right_record.source_file_name,
                right_sheet_name=right_record.sheet_name,
                right_row_number=right_record.excel_row_number,
                expected_value=_format_match_key(left_record, left_match_fields),
                actual_value=_format_match_key(right_record, right_match_fields),
                suggested_correction="Review the match fields on both rows; they appear to refer to the same row position but use different match values.",
                notes=f"Match key differs using {_friendly_match_strategy(rule)}.",
            )
        )

    for pair_index, (left_record, right_record) in enumerate(pairs):
        if pair_index in skipped_pair_indexes:
            continue
        if not left_record or not right_record:
            missing_side = "right" if left_record else "left"
            source = left_record or right_record
            source_match_fields = _match_field_ids(rule, "left" if left_record else "right")
            if source and _has_blank_match_key(source, source_match_fields):
                continue
            left_value = get_field_value(left_record, rule.left_field_id) if left_record and rule.left_field_id else None
            right_value = get_field_value(right_record, rule.right_field_id) if right_record and rule.right_field_id else None
            discrepancies.append(
                RuleDiscrepancy(
                    rule_id=rule.id,
                    rule_name=rule.rule_name,
                    rule_type=rule.rule_type,
                    severity=rule.severity,
                    left_file_name=left_record.source_file_name if left_record else _source_file_name(left_source),
                    left_sheet_name=left_record.sheet_name if left_record else left_source.sheet_name if left_source else None,
                    left_row_number=left_record.excel_row_number if left_record else None,
                    right_file_name=right_record.source_file_name if right_record else _source_file_name(right_source),
                    right_sheet_name=right_record.sheet_name if right_record else right_source.sheet_name if right_source else None,
                    right_row_number=right_record.excel_row_number if right_record else None,
                    left_field_name=left_value.display_name if left_value else left_field.display_name if left_field else None,
                    right_field_name=right_value.display_name if right_value else right_field.display_name if right_field else None,
                    expected_value=_stringify(left_value.raw_value) if left_value else "Blank",
                    actual_value=_stringify(right_value.raw_value) if right_value else "Blank",
                    suggested_correction="Check selected rows and match fields; one side may be missing this item.",
                    notes=f"No matching row was found using {_friendly_match_strategy(rule)}.",
                )
            )
            continue

        left_value = get_field_value(left_record, rule.left_field_id) if rule.left_field_id else None
        right_value = get_field_value(right_record, rule.right_field_id) if rule.right_field_id else None
        if left_value is None or right_value is None:
            continue
        if _compare_values(left_value.normalized_value, right_value.normalized_value, rule, left_field.field_type if left_field else "text"):
            continue
        suggested_correction, notes = _comparison_guidance(
            left_value,
            right_value,
            rule,
            left_field.field_type if left_field else "text",
        )
        discrepancies.append(
            RuleDiscrepancy(
                rule_id=rule.id,
                rule_name=rule.rule_name,
                rule_type=rule.rule_type,
                severity=rule.severity,
                left_file_name=left_record.source_file_name,
                left_sheet_name=left_record.sheet_name,
                left_row_number=left_record.excel_row_number,
                left_field_name=left_value.display_name,
                right_file_name=right_record.source_file_name,
                right_sheet_name=right_record.sheet_name,
                right_row_number=right_record.excel_row_number,
                right_field_name=right_value.display_name,
                expected_value=_stringify(left_value.raw_value),
                actual_value=_stringify(right_value.raw_value),
                suggested_correction=suggested_correction,
                notes=notes,
            )
        )
    return discrepancies


def _formula_result(operator: str, left: Decimal | None, right: Decimal | None) -> Decimal | None:
    if left is None or right is None:
        return None
    if operator == "add":
        return left + right
    if operator == "subtract":
        return left - right
    if operator == "divide":
        if right == 0:
            return None
        return left / right
    return left * right


def _formula_rule(
    rule: ComparisonRule,
    data_sources: list[ComparisonDataSource],
    records: list[ExtractedRecord],
) -> list[RuleDiscrepancy]:
    if not rule.formula_settings or not rule.left_data_source_id:
        return []
    source_records = _rule_records(records, rule.left_data_source_id)
    operand_fields = [get_field(data_sources, field_id) for field_id in rule.formula_settings.operand_field_ids]
    result_field = get_field(data_sources, rule.formula_settings.result_field_id)
    discrepancies: list[RuleDiscrepancy] = []
    for record in source_records:
        operands = [get_field_value(record, field.id) for field in operand_fields]
        result_value = get_field_value(record, result_field.id)
        numbers = [value.normalized_value if value else None for value in operands]
        expected = _formula_result(rule.formula_settings.operator, numbers[0], numbers[1])
        actual = result_value.normalized_value if result_value else None
        if _compare_values(expected, actual, rule, result_field.field_type):
            continue
        discrepancies.append(
            RuleDiscrepancy(
                rule_id=rule.id,
                rule_name=rule.rule_name,
                rule_type=rule.rule_type,
                severity=rule.severity,
                left_file_name=record.source_file_name,
                left_sheet_name=record.sheet_name,
                left_row_number=record.excel_row_number,
                left_field_name=result_field.display_name,
                expected_value=_stringify(expected),
                actual_value=_stringify(result_value.raw_value if result_value else None),
                suggested_correction=f"Recalculate or review {result_field.display_name} for this row.",
                notes=f"Expected {operand_fields[0].display_name} {rule.formula_settings.operator} {operand_fields[1].display_name}; found a different result.",
            )
        )
    return discrepancies


def _required_field_rule(rule: ComparisonRule, records: list[ExtractedRecord]) -> list[RuleDiscrepancy]:
    source_records = _rule_records(records, rule.left_data_source_id)
    discrepancies: list[RuleDiscrepancy] = []
    for record in source_records:
        field_value = get_field_value(record, rule.left_field_id) if rule.left_field_id else None
        if field_value and field_value.normalized_value not in (None, ""):
            continue
        field_name = field_value.display_name if field_value else "required field"
        discrepancies.append(
            RuleDiscrepancy(
                rule_id=rule.id,
                rule_name=rule.rule_name,
                rule_type=rule.rule_type,
                severity=rule.severity,
                left_file_name=record.source_file_name,
                left_sheet_name=record.sheet_name,
                left_row_number=record.excel_row_number,
                left_field_name=field_value.display_name if field_value else None,
                expected_value="Required value",
                actual_value="Blank",
                suggested_correction=f"Fill in {field_name} or exclude the row if it is not valid data.",
                notes="A required mapped field is blank in a selected row.",
            )
        )
    return discrepancies


def _duplicate_rule(rule: ComparisonRule, records: list[ExtractedRecord]) -> list[RuleDiscrepancy]:
    source_records = _rule_records(records, rule.left_data_source_id)
    key_fields = rule.left_match_field_ids or ([rule.left_field_id] if rule.left_field_id else [])
    counts = Counter(_key_for_record(record, key_fields) for record in source_records)
    duplicates = {key for key, count in counts.items() if key and count > 1}
    discrepancies: list[RuleDiscrepancy] = []
    for record in source_records:
        key = _key_for_record(record, key_fields)
        if key not in duplicates:
            continue
        discrepancies.append(
            RuleDiscrepancy(
                rule_id=rule.id,
                rule_name=rule.rule_name,
                rule_type=rule.rule_type,
                severity=rule.severity,
                left_file_name=record.source_file_name,
                left_sheet_name=record.sheet_name,
                left_row_number=record.excel_row_number,
                expected_value="Unique value",
                actual_value=", ".join(key),
                suggested_correction="Keep one valid row, merge duplicates, or exclude duplicate rows from validation.",
                notes="The same match value appears more than once in the selected rows.",
            )
        )
    return discrepancies


def run_validation(request: ValidationRequest) -> ValidationResult:
    data_sources = request.data_sources
    records: list[ExtractedRecord] = []
    for data_source in data_sources:
        records.extend(extract_records(data_source))

    discrepancies: list[RuleDiscrepancy] = []
    for rule in request.rules:
        if not rule.enabled:
            continue
        if rule.rule_type == "compare_values":
            discrepancies.extend(_compare_rule(rule, data_sources, records))
        elif rule.rule_type == "formula_check":
            discrepancies.extend(_formula_rule(rule, data_sources, records))
        elif rule.rule_type == "required_field_check":
            discrepancies.extend(_required_field_rule(rule, records))
        elif rule.rule_type == "duplicate_check":
            discrepancies.extend(_duplicate_rule(rule, records))

    rule_counts = Counter(item.rule_id for item in discrepancies)
    summaries = [
        RuleSummary(
            rule_id=rule.id,
            rule_name=rule.rule_name,
            rule_type=rule.rule_type,
            severity=rule.severity,
            discrepancy_count=rule_counts.get(rule.id, 0),
        )
        for rule in request.rules
        if rule.enabled
    ]
    file_names = sorted({record.source_file_name for record in records})
    breakdown = dict(Counter(item.severity for item in discrepancies))
    return ValidationResult(
        id=uuid4().hex,
        project_name=request.project_name,
        preset=request.preset,
        created_at=datetime.now(timezone.utc).isoformat(),
        file_names=file_names,
        total_selected_rows=len(records),
        data_sources=data_sources,
        extracted_records=records,
        rule_summaries=summaries,
        discrepancies=discrepancies,
        breakdown=breakdown,
    )
