from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

from app.models.comparison_models import (
    ComparisonDataSource,
    ComparisonRule,
    ExtractedRecord,
    FieldType,
    RuleDiscrepancy,
    RuleSummary,
    ValidationRequest,
    ValidationResult,
)
from app.services.extraction_service import extract_records, get_field, get_field_value
from app.normalizers.text_normalizer import normalize_text


def _stringify(value: object) -> str | None:
    if value is None:
        return None
    return str(value)


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
    discrepancies: list[RuleDiscrepancy] = []

    for left_record, right_record in _matched_pairs(left_records, right_records, rule):
        if not left_record or not right_record:
            missing_side = "right" if left_record else "left"
            source = left_record or right_record
            discrepancies.append(
                RuleDiscrepancy(
                    rule_id=rule.id,
                    rule_name=rule.rule_name,
                    rule_type=rule.rule_type,
                    severity=rule.severity,
                    left_file_name=left_record.source_file_name if left_record else None,
                    left_sheet_name=left_record.sheet_name if left_record else None,
                    left_row_number=left_record.excel_row_number if left_record else None,
                    right_file_name=right_record.source_file_name if right_record else None,
                    right_sheet_name=right_record.sheet_name if right_record else None,
                    right_row_number=right_record.excel_row_number if right_record else None,
                    expected_value="Matching row",
                    actual_value=f"Missing {missing_side} match",
                    suggested_correction="Confirm the selected rows and match fields.",
                    notes=f"No matching row was found using {rule.match_strategy}.",
                )
            )
            continue

        left_value = get_field_value(left_record, rule.left_field_id) if rule.left_field_id else None
        right_value = get_field_value(right_record, rule.right_field_id) if rule.right_field_id else None
        if left_value is None or right_value is None:
            continue
        if _compare_values(left_value.normalized_value, right_value.normalized_value, rule, left_field.field_type if left_field else "text"):
            continue
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
                suggested_correction=f"Align {right_value.display_name} with {left_value.display_name}.",
                notes=f"Compared using {rule.strictness}.",
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
                suggested_correction=f"Review the formula for {result_field.display_name}.",
                notes=f"Expected {operand_fields[0].display_name} {rule.formula_settings.operator} {operand_fields[1].display_name}.",
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
                suggested_correction="Fill in the required field or exclude the row.",
                notes="Required field check.",
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
                suggested_correction="Remove or merge duplicate rows.",
                notes="Duplicate check matched another selected row.",
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

    for record in records:
        for issue in record.extraction_issues:
            discrepancies.append(
                RuleDiscrepancy(
                    rule_id="extraction",
                    rule_name="Extraction issue",
                    rule_type="required_field_check",
                    severity="high",
                    left_file_name=record.source_file_name,
                    left_sheet_name=record.sheet_name,
                    left_row_number=record.excel_row_number,
                    expected_value="Valid extracted row",
                    actual_value=issue,
                    suggested_correction="Review the field mapping and source row selection.",
                    notes="Raised during extraction before rule comparison.",
                )
            )

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
