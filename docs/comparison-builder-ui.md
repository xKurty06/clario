# Comparison Builder UI

## What changed

The first Comparison Builder UI exposed sources, row preview, field mapping, rule editing, and validation on one large page. It worked functionally, but it felt like a scaffold form: too many dropdowns, wide rows, cramped controls, and source names that implied roles before the user confirmed them.

The updated UI uses a staged workflow:

1. Sources
2. Rows
3. Fields
4. Rules
5. Review & Run

The URL can remain `/mapping` for compatibility, but the component and visible workflow are now the Comparison Builder.

## Preset behavior

Presets guide the setup but do not automatically assign meaning to uploaded files. Sources start with neutral filename-based names such as `Source 1 - file.xlsx`.

When a preset is selected, the builder shows an explicit setup card. The user can:

- Apply preset setup
- Start manually

Applying a preset can suggest labels such as Reference, Bidder, Abstract, or Copied file. Starting manually keeps neutral source names.

## Sources

The Sources step shows compact source cards with:

- Source name
- File and sheet
- Header row
- First data row
- Selected row count
- Field count
- Edit, preview, and delete actions

Detailed editing happens in a drawer so the main page stays scannable.

## Rows

The Rows step uses a compact details table with checkboxes, Excel row numbers, status badges, sticky headers, hover states, and selected-row highlighting.

Row actions include:

- Select all
- Select none
- Invert
- Select visible
- Exclude blank rows
- Exclude total rows
- Exclude subtotal rows
- Exclude grand total rows
- Mark selected ignored
- Mark selected data

The backend still performs assisted detection first; the user corrects the selected row set in the UI.

## Fields

Fields are shown as cards instead of a wide grid of dropdowns. Each card shows:

- Field name
- Type
- Column letter
- Header label
- Required or optional status

Adding and editing fields happens in a drawer. The column picker always shows column letters first, and blank headers remain selectable.

## Rules

Rules are shown as cards. Each card summarizes:

- Rule name
- Rule type
- Expected and actual source/field
- Match strategy
- Comparison strictness
- Enabled state

The rule drawer asks for the intended check, expected value, actual value when applicable, row matching, strictness, tolerance, severity, and enabled state. The backend rule model is unchanged.

## Review & Run

The final step summarizes files, sources, selected rows, fields, and enabled rules. It also warns about incomplete setup:

- Source has no preview
- Source has zero selected rows
- Source has no fields
- Rule is incomplete
- No enabled rules

Validation is enabled only when the setup is sufficiently complete.

## Remaining UI limitations

- Formula rule editing supports the current backend formula shape but is still basic.
- Multi-field matching is represented in the rule model, but the UI does not yet provide a dedicated multi-field picker.
- Manual row pairing remains a future workflow.
