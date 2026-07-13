import type { ComparisonDataSource, ComparisonField, DataSourcePreview, FieldType } from "../types/validation.types";

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function normalizedFieldKey(value: string) {
  return value.toLowerCase().match(/[a-z0-9]+/g)?.join(" ") ?? "";
}

export function fieldTypeForLabel(label: string): FieldType {
  const key = normalizedFieldKey(label);
  if (/\b(cost|price|amount|total|value|rate)\b/.test(key)) return "currency";
  if (/\b(qty|quantity|count|number|no|percent|percentage)\b/.test(key)) return "number";
  if (/\b(date|time|deadline|created|updated)\b/.test(key)) return "date";
  return "text";
}

export function buildSuggestedFieldsForSource(
  source: ComparisonDataSource,
  preview: DataSourcePreview,
  allPreviews: Record<string, DataSourcePreview>,
): ComparisonField[] {
  const matchingKeys = new Set<string>();
  for (const [sourceId, otherPreview] of Object.entries(allPreviews)) {
    if (sourceId === source.id) continue;
    for (const column of otherPreview.columns) {
      const key = normalizedFieldKey(column.header_label || column.display_label);
      if (key) matchingKeys.add(key);
    }
  }

  const existingFieldKeys = new Set(source.fields.map((field) => normalizedFieldKey(field.custom_display_name || field.field_name)));
  const existingColumns = new Set(source.fields.map((field) => field.column_letter.toUpperCase()));
  const seenKeys = new Set<string>();

  return preview.columns
    .map((column) => {
      const label = column.header_label || column.display_label || column.letter;
      const key = normalizedFieldKey(label);
      if (!key || !matchingKeys.has(key) || existingFieldKeys.has(key) || existingColumns.has(column.letter.toUpperCase()) || seenKeys.has(key)) {
        return null;
      }
      seenKeys.add(key);
      const suggestedField: ComparisonField = {
        id: makeId("field"),
        data_source_id: source.id,
        field_name: label,
        field_type: fieldTypeForLabel(label),
        column_letter: column.letter,
        original_header_label: column.header_label,
        custom_display_name: label,
        required: true,
        normalization: { case_insensitive: true, trim_whitespace: true, collapse_whitespace: true },
      };
      return suggestedField;
    })
    .filter((field): field is ComparisonField => Boolean(field));
}
