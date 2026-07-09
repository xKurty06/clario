from collections import Counter
from datetime import datetime, timezone
from uuid import uuid4

from app.models.row_models import ExtractedRow
from app.models.validation_models import Discrepancy, ValidationRequest, ValidationResult
from app.normalizers.text_normalizer import normalize_text
from app.validators.description_validator import DescriptionValidator
from app.validators.duplicate_validator import DuplicateValidator
from app.validators.quantity_validator import QuantityValidator
from app.validators.total_cost_validator import TotalCostValidator
from app.validators.unit_cost_validator import UnitCostValidator


def _pair(reference: list[ExtractedRow], comparison: list[ExtractedRow]):
    used: set[int] = set()
    for index, ref in enumerate(reference):
        match = None
        if ref.item_number:
            match = next((i for i, row in enumerate(comparison) if i not in used and row.item_number and normalize_text(row.item_number, True) == normalize_text(ref.item_number, True)), None)
        if match is None and index < len(comparison) and index not in used: match = index
        if match is None: yield ref, None
        else: used.add(match); yield ref, comparison[match]
    for i, row in enumerate(comparison):
        if i not in used: yield None, row


def run_validation(request: ValidationRequest) -> ValidationResult:
    discrepancies: list[Discrepancy] = []
    comparison = request.comparison_rows
    if request.mode == "reference_bidder_abstract": comparison = request.abstract_rows
    fields = set(request.compare_fields)
    for reference, candidate in _pair(request.reference_rows, comparison):
        if reference is None and candidate:
            discrepancies.append(Discrepancy(issue_type="extra_item", severity="medium", source_file_name=candidate.source_file_name,
                comparison_sheet=candidate.sheet_name, comparison_row=candidate.excel_row_number, comparison_description=candidate.item_description,
                suggested_correction="Confirm or remove the extra item.")); continue
        if candidate is None and reference:
            discrepancies.append(Discrepancy(issue_type="missing_item", severity="high", source_file_name=reference.source_file_name,
                reference_sheet=reference.sheet_name, reference_row=reference.excel_row_number, reference_description=reference.item_description,
                suggested_correction="Add the missing reference item.")); continue
        assert reference and candidate
        if "description" in fields: discrepancies.extend(DescriptionValidator().validate((reference, candidate, request.case_insensitive)))
        if "quantity" in fields: discrepancies.extend(QuantityValidator().validate((reference, candidate)))
        if "unit" in fields and normalize_text(reference.unit, True) != normalize_text(candidate.unit, True):
            discrepancies.append(Discrepancy(issue_type="unit_mismatch", severity="medium", source_file_name=candidate.source_file_name,
                reference_sheet=reference.sheet_name, reference_row=reference.excel_row_number, comparison_sheet=candidate.sheet_name,
                comparison_row=candidate.excel_row_number, reference_description=reference.item_description,
                expected_value=reference.unit, actual_value=candidate.unit, suggested_correction=f"Use reference unit {reference.unit}."))
        if request.mode == "reference_bidder_abstract":
            bidder = next((row for row in request.bidder_rows if (row.item_number and reference.item_number and normalize_text(row.item_number, True) == normalize_text(reference.item_number, True)) or normalize_text(row.item_description, request.case_insensitive) == normalize_text(reference.item_description, request.case_insensitive)), None)
            if bidder:
                discrepancies.extend(UnitCostValidator().validate((bidder, candidate)))
                expected = reference.quantity * bidder.unit_cost if reference.quantity is not None and bidder.unit_cost is not None else None
                discrepancies.extend(TotalCostValidator().validate((candidate, expected)))
        else:
            if "unit_cost" in fields: discrepancies.extend(UnitCostValidator().validate((reference, candidate)))
            if "total_cost" in fields:
                expected = candidate.quantity * candidate.unit_cost if candidate.quantity is not None and candidate.unit_cost is not None else reference.total_cost
                discrepancies.extend(TotalCostValidator().validate((candidate, expected)))
    for rows in [request.reference_rows, comparison]: discrepancies.extend(DuplicateValidator().validate(rows))
    for row in request.reference_rows + comparison:
        for issue in row.extraction_issues:
            discrepancies.append(Discrepancy(issue_type="invalid_number_format", severity="high", source_file_name=row.source_file_name,
                comparison_sheet=row.sheet_name, comparison_row=row.excel_row_number, comparison_description=row.item_description, notes=issue))
    breakdown = dict(Counter(item.issue_type for item in discrepancies))
    result = ValidationResult(id=uuid4().hex, project_name=request.project_name, mode=request.mode,
        created_at=datetime.now(timezone.utc).isoformat(), total_rows=len(request.reference_rows) + len(comparison),
        discrepancies=discrepancies, breakdown=breakdown)
    return result
