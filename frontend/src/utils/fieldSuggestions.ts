import type { ComparisonDataSource, ComparisonField, DataSourcePreview, FieldType } from "../types/validation.types";

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function normalizedFieldKey(value: string) {
  return value.toLowerCase().match(/[a-z0-9]+/g)?.join(" ") ?? "";
}

function fieldNameFromHeader(label: string) {
  const parts = label.split("/").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return label.trim();
  const groupPrefixes = new Set([
    "item master",
    "item offered",
    "planning values",
    "bid pricing",
    "fulfillment notes",
  ]);
  const firstPart = normalizedFieldKey(parts[0] ?? "");
  return groupPrefixes.has(firstPart) ? parts.slice(1).join(" / ") : parts.join(" / ");
}

function canonicalToken(token: string) {
  const aliases: Record<string, string> = {
    sku: "item",
    item: "item",
    product: "item",
    part: "item",
    material: "item",
    code: "id",
    id: "id",
    no: "id",
    number: "id",
    ref: "id",
    reference: "id",
    description: "description",
    desc: "description",
    name: "description",
    title: "description",
    detail: "description",
    details: "description",
    specification: "description",
    qty: "quantity",
    quantity: "quantity",
    count: "quantity",
    order: "quantity",
    approved: "quantity",
    unit: "unit",
    uom: "unit",
    measure: "unit",
    cost: "price",
    price: "price",
    pricing: "price",
    rate: "price",
    amount: "total",
    total: "total",
    value: "total",
    extended: "total",
    listed: "total",
    notes: "notes",
    note: "notes",
    remarks: "notes",
    comment: "notes",
    comments: "notes",
  };
  return aliases[token] ?? token;
}

function fieldTokens(label: string) {
  return normalizedFieldKey(label)
    .split(" ")
    .map(canonicalToken)
    .filter((token) => token.length > 1 && !["a", "an", "and", "by", "for", "of", "the", "to", "with"].includes(token));
}

function fieldSimilarity(leftLabel: string, rightLabel: string) {
  const left = new Set(fieldTokens(leftLabel));
  const right = new Set(fieldTokens(rightLabel));
  if (!left.size || !right.size) return 0;
  const overlap = [...left].filter((token) => right.has(token)).length;
  if (!overlap) return 0;
  const union = new Set([...left, ...right]).size;
  return overlap / union;
}

function hasRelatedColumn(label: string, otherLabels: string[]) {
  const key = normalizedFieldKey(label);
  return otherLabels.some((otherLabel) => {
    const otherKey = normalizedFieldKey(otherLabel);
    return key === otherKey || fieldSimilarity(label, otherLabel) >= 0.2;
  });
}

function isMeaningfulHeader(label: string) {
  const tokens = fieldTokens(label);
  return tokens.length > 0 && !tokens.every((token) => token === "blank" || token === "column");
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
  const otherLabels: string[] = [];
  for (const [sourceId, otherPreview] of Object.entries(allPreviews)) {
    if (sourceId === source.id) continue;
    for (const column of otherPreview.columns) {
      const label = column.header_label || column.display_label;
      if (isMeaningfulHeader(label)) otherLabels.push(label);
    }
  }

  const existingFieldKeys = new Set(source.fields.map((field) => normalizedFieldKey(field.custom_display_name || field.field_name)));
  const existingColumns = new Set(source.fields.map((field) => field.column_letter.toUpperCase()));
  const seenKeys = new Set<string>();

  return preview.columns
    .map((column) => {
      const label = column.header_label || column.display_label || column.letter;
      const fieldName = fieldNameFromHeader(label);
      const key = normalizedFieldKey(fieldName);
      const hasMatch = otherLabels.length > 0 && hasRelatedColumn(label, otherLabels);
      if (!key || !isMeaningfulHeader(fieldName) || existingFieldKeys.has(key) || existingColumns.has(column.letter.toUpperCase()) || seenKeys.has(key)) {
        return null;
      }
      seenKeys.add(key);
      const suggestedField: ComparisonField = {
        id: makeId("field"),
        data_source_id: source.id,
        field_name: fieldName,
        field_type: fieldTypeForLabel(fieldName),
        column_letter: column.letter,
        original_header_label: column.header_label,
        custom_display_name: fieldName,
        required: true,
        normalization: { case_insensitive: true, trim_whitespace: true, collapse_whitespace: true },
      };
      return { field: suggestedField, hasMatch };
    })
    .filter((item): item is { field: ComparisonField; hasMatch: boolean } => Boolean(item))
    .map((item) => item.field);
}
