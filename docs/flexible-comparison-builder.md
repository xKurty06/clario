# Flexible Comparison Builder

## Why this refactor was needed

The original workflow assumed one file role, one main sheet, and one fixed set of procurement columns. That was fast for clean workbooks, but it broke down on real procurement documents with repeated sections, multiple useful sheets, inconsistent headers, and custom comparison needs.

The builder refactor moves the app to a more flexible model:

`Data Sources -> Selected Rows -> Custom Fields -> Comparison Rules`

This keeps validation transparent and local-first while removing the hardcoded dependency on a single procurement layout.

## Old fixed-model limitations

- A file could only behave as one role at a time.
- The mapping flow focused on one sheet per file.
- The core fields were hardcoded to procurement-specific columns.
- Header text carried too much identity.
- Row selection was mostly implicit rather than reviewable.
- Validation logic was tied to preset workflows instead of explicit rules.

## New model

### Data sources

A data source represents one file, one sheet, one header row, one first-data-row marker, one row selection, and one field set. Multiple data sources can point to the same uploaded file.

Each data source stores:

- File id and file name
- Sheet name
- Header row
- First data row
- Selected row numbers
- Ignored row numbers
- Row selection mode
- Custom fields

### Row selection

The backend still performs assisted row detection first. The frontend then exposes a checkbox table so the user can:

- Select all rows
- Select no rows
- Invert selection
- Manually include or exclude rows

Only selected rows are extracted for validation.

### Custom fields

Fields replace the old fixed column mapping. Every field stores:

- Field name
- Field type
- Column letter
- Original header label
- Optional custom display name
- Required flag
- Normalization settings

Column letters remain first-class even when the header text is duplicated, blank, merged, or unclear.

### Comparison rules

Rules now define what validation means for a session. Version 1 of the builder supports:

- `compare_values`
- `formula_check`
- `required_field_check`
- `duplicate_check`

Rules can match rows by:

- Row order
- Item number field
- Exact text field
- Multiple fields

Strictness options are:

- `exact`
- `normalized_exact`
- `numeric_tolerance`
- `currency_tolerance`

Fuzzy matching is intentionally not part of this version.

## How presets work

Presets are now scaffolding, not hardcoded validation engines.

They create a starting point for:

- Data sources
- Common procurement fields
- Initial comparison rules

The user can then adjust row selections, fields, and rules as needed.

## Adding future rule types

To add a new rule type:

1. Add the rule literal to `backend/app/models/comparison_models.py`.
2. Extend `run_validation()` in `backend/app/services/validation_service.py`.
3. Add the UI option in the builder page.
4. Add tests for extraction, rule execution, and reporting.

## Future AI assistance

AI remains disabled as a decision-maker. A future local assistant could suggest:

- Candidate data sources
- Likely field mappings
- Candidate comparison rules

But the extracted data, selected rows, and final validation result must remain explicit, reviewable, and deterministic.

## Security and privacy

- Files stay local.
- No cloud upload is added.
- No telemetry or analytics is added.
- Validation is performed in the backend on the local machine.
- PDF export uses the completed validation result and does not re-run validation.
- Original source files are never overwritten.
