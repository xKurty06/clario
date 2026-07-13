import type { ComparisonDataSource, ComparisonRule, DataSourcePreview, PresetType, PreviewRow } from "../../types/validation.types";

export type PreflightSeverity = "blocker" | "warning" | "ready";

export interface PreflightItem {
  id: string;
  severity: Exclude<PreflightSeverity, "ready">;
  title: string;
  detail: string;
  sourceId?: string;
  ruleId?: string;
}

export interface PreflightSummary {
  files: number;
  sources: number;
  selectedRows: number;
  mappedFields: number;
  enabledRules: number;
}

export interface PreflightReview {
  status: PreflightSeverity;
  blockers: PreflightItem[];
  warnings: PreflightItem[];
  summary: PreflightSummary;
  canRun: boolean;
}

export interface BuildPreflightReviewInput {
  projectName: string;
  preset: PresetType | "";
  fileCount: number;
  dataSources: ComparisonDataSource[];
  rules: ComparisonRule[];
  sourcePreviews?: Record<string, DataSourcePreview | undefined>;
}

const summaryTerms = ["grand total", "subtotal", "total"];
const sectionTerms = ["lot", "section", "category"];
const footerTerms = ["signature", "prepared by", "approved by", "certified by", "noted by", "checked by"];

function ruleName(rule: ComparisonRule) {
  return rule.rule_name.trim() || "Unnamed rule";
}

function addRuleBlockers(rule: ComparisonRule, blockers: PreflightItem[]) {
  if (!rule.enabled) return;

  if (!rule.rule_name.trim()) {
    blockers.push({
      id: `rule-${rule.id}-name`,
      ruleId: rule.id,
      severity: "blocker",
      title: "Rule name is missing",
      detail: "Give every enabled rule a clear name before running validation.",
    });
  }

  if (rule.rule_type === "compare_values" && !(rule.left_data_source_id && rule.left_field_id && rule.right_data_source_id && rule.right_field_id)) {
    blockers.push({
      id: `rule-${rule.id}-compare-fields`,
      ruleId: rule.id,
      severity: "blocker",
      title: `${ruleName(rule)} is incomplete`,
      detail: "Choose both expected and actual source fields for this comparison rule.",
    });
  }

  if (rule.rule_type === "formula_check") {
    const formula = rule.formula_settings;
    if (!(rule.left_data_source_id && formula?.operand_field_ids?.[0] && formula?.operand_field_ids?.[1] && formula.result_field_id && formula.operator)) {
      blockers.push({
        id: `rule-${rule.id}-formula`,
        ruleId: rule.id,
        severity: "blocker",
        title: `${ruleName(rule)} is incomplete`,
        detail: "Formula rules need a source, two operand fields, an operator, and a result field.",
      });
    }
  }

  if ((rule.rule_type === "required_field_check" || rule.rule_type === "duplicate_check") && !(rule.left_data_source_id && rule.left_field_id)) {
    blockers.push({
      id: `rule-${rule.id}-single-field`,
      ruleId: rule.id,
      severity: "blocker",
      title: `${ruleName(rule)} is incomplete`,
      detail: "Choose the source and field this rule should check.",
    });
  }

  if (rule.strictness === "numeric_tolerance" && !rule.numeric_tolerance) {
    blockers.push({
      id: `rule-${rule.id}-numeric-tolerance`,
      ruleId: rule.id,
      severity: "blocker",
      title: `${ruleName(rule)} needs a tolerance`,
      detail: "Enter a numeric tolerance before running this rule.",
    });
  }

  if (rule.strictness === "currency_tolerance" && !rule.currency_tolerance) {
    blockers.push({
      id: `rule-${rule.id}-currency-tolerance`,
      ruleId: rule.id,
      severity: "blocker",
      title: `${ruleName(rule)} needs a tolerance`,
      detail: "Enter a currency tolerance before running this rule.",
    });
  }
}

function rawCellValue(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function containsTerm(text: string, term: string) {
  return new RegExp(`(^|\\s)${term.replace(/\s+/g, "\\s+")}(\\s|$)`, "i").test(text);
}

function meaningfulCellValues(row: PreviewRow) {
  return Object.values(row.cells)
    .map(rawCellValue)
    .filter((value) => value.length > 0 && value !== "-" && value !== "—" && value.toLowerCase() !== "n/a");
}

function rowText(row: PreviewRow) {
  return meaningfulCellValues(row).join(" ");
}

function leadingText(row: PreviewRow) {
  return meaningfulCellValues(row).slice(0, 4).join(" ");
}

function looksLikeRepeatedLabelRow(values: string[]) {
  if (values.length < 4) return false;
  const counts = new Map<string, number>();
  for (const value of values.map(normalizeText).filter(Boolean)) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  const highestCount = Math.max(0, ...counts.values());
  return highestCount / values.length >= 0.6;
}

function looksLikeHeaderRow(row: PreviewRow, preview: DataSourcePreview) {
  const values = meaningfulCellValues(row);
  if (preview.columns.length < 2 || values.length < 2) return false;
  const normalizedHeaders = new Set(preview.columns.map((column) => normalizeText(column.header_label)).filter(Boolean));
  const exactHeaderHits = values.map(normalizeText).filter((value) => normalizedHeaders.has(value)).length;
  return exactHeaderHits >= Math.min(2, normalizedHeaders.size);
}

function looksLikeSummaryOrSectionRow(row: PreviewRow, term: string) {
  const values = meaningfulCellValues(row);
  const allText = normalizeText(rowText(row));
  const leadText = normalizeText(leadingText(row));
  if (!containsTerm(allText, term)) return false;
  return containsTerm(leadText, term) || values.length <= 3 || looksLikeRepeatedLabelRow(values);
}

function selectedRowIssue(row: PreviewRow, preview: DataSourcePreview) {
  const values = meaningfulCellValues(row);
  const allText = normalizeText(rowText(row));
  const leadText = normalizeText(leadingText(row));
  const nonEmptyRatio = values.length / Math.max(1, Object.keys(row.cells).length);

  if (!values.length) return "blank selected row";
  if (values.length <= 1 || nonEmptyRatio < 0.2) return "mostly empty selected row";
  if (looksLikeHeaderRow(row, preview)) return "looks like a header row";
  if (looksLikeRepeatedLabelRow(values)) return "repeated label row";

  const footerTerm = footerTerms.find((term) => containsTerm(allText, term));
  if (footerTerm) return `contains “${footerTerm}”`;

  const summaryTerm = summaryTerms.find((term) => looksLikeSummaryOrSectionRow(row, term));
  if (summaryTerm) return `summary row: “${summaryTerm}”`;

  const sectionTerm = sectionTerms.find((term) => containsTerm(leadText, term) && values.length <= 4);
  if (sectionTerm) return `section row: “${sectionTerm}”`;

  return null;
}

function mappedValue(row: PreviewRow, preview: DataSourcePreview, columnLetter: string) {
  const column = preview.columns.find((item) => item.letter.toUpperCase() === columnLetter.toUpperCase());
  return rawCellValue(row.cells[column?.header_label ?? columnLetter] ?? row.cells[columnLetter] ?? null);
}

function selectedPreviewRows(source: ComparisonDataSource, preview: DataSourcePreview) {
  const selected = new Set(source.selected_row_numbers);
  return preview.rows.filter((row) => selected.has(row.row_number) && !row.ignored && !source.ignored_row_numbers.includes(row.row_number));
}

function selectedRequiredFields(source: ComparisonDataSource) {
  const required = source.fields.filter((field) => field.required);
  return required.length ? required : source.fields.slice(0, Math.min(2, source.fields.length));
}

function addSelectedRowContentWarnings(source: ComparisonDataSource, preview: DataSourcePreview | undefined, warnings: PreflightItem[]) {
  if (!preview || !source.selected_row_numbers.length) return;

  const sourceName = source.name.trim() || "Unnamed source";
  const requiredFields = selectedRequiredFields(source);

  for (const row of selectedPreviewRows(source, preview)) {
    const issue = selectedRowIssue(row, preview);
    const mappedValues = source.fields.map((field) => mappedValue(row, preview, field.column_letter)).filter(Boolean);
    const requiredValues = requiredFields.map((field) => mappedValue(row, preview, field.column_letter)).filter(Boolean);

    if (issue) {
      warnings.push({
        id: `source-${source.id}-row-${row.row_number}-review`,
        sourceId: source.id,
        severity: "warning",
        title: `${sourceName} row ${row.row_number} should be reviewed`,
        detail: `This selected row is flagged as ${issue}. This is only a warning; continue if the row is a real data row, or exclude it if it is a section, footer, spacer, or summary row.`,
      });
    }

    if (source.fields.length && !mappedValues.length) {
      warnings.push({
        id: `source-${source.id}-row-${row.row_number}-no-mapped-values`,
        sourceId: source.id,
        severity: "warning",
        title: `${sourceName} row ${row.row_number} has no mapped field values`,
        detail: "The row is selected, but none of the mapped columns contain values. Check whether this is a real record or an extra spacer/header row.",
      });
    }

    if (requiredFields.length && !requiredValues.length) {
      warnings.push({
        id: `source-${source.id}-row-${row.row_number}-required-blank`,
        sourceId: source.id,
        severity: "warning",
        title: `${sourceName} row ${row.row_number} is missing required values`,
        detail: "Required mapped fields are blank on this selected row. Continue only if blank values are expected for this source.",
      });
    }
  }
}

export function buildPreflightReview({ projectName, preset, fileCount, dataSources, rules, sourcePreviews = {} }: BuildPreflightReviewInput): PreflightReview {
  const blockers: PreflightItem[] = [];
  const warnings: PreflightItem[] = [];
  const enabledRules = rules.filter((rule) => rule.enabled);

  if (!projectName.trim()) {
    blockers.push({
      id: "project-name",
      severity: "blocker",
      title: "Session name is missing",
      detail: "Enter a session name so the validation result and exported report are traceable.",
    });
  }

  if (!preset) {
    blockers.push({
      id: "preset",
      severity: "blocker",
      title: "Comparison preset is missing",
      detail: "Choose a preset or custom builder mode before running validation.",
    });
  }

  if (fileCount < 1) {
    blockers.push({
      id: "files",
      severity: "blocker",
      title: "No files are available",
      detail: "Upload at least one spreadsheet before running validation.",
    });
  }

  if (!dataSources.length) {
    blockers.push({
      id: "sources",
      severity: "blocker",
      title: "No sources are configured",
      detail: "Create at least one source from the uploaded files.",
    });
  }

  for (const source of dataSources) {
    const sourceName = source.name.trim() || "Unnamed source";
    const preview = sourcePreviews[source.id];

    if (!source.row_setup_confirmed) {
      blockers.push({
        id: `source-${source.id}-row-setup`,
        sourceId: source.id,
        severity: "blocker",
        title: `${sourceName} row setup is not confirmed`,
        detail: "Confirm the header row and first data row first. Header row should contain column names; first data row should be the first real record or item, not a title, lot label, blank row, signature row, or total row.",
      });
    }

    if (!source.selected_row_numbers.length) {
      blockers.push({
        id: `source-${source.id}-rows`,
        sourceId: source.id,
        severity: "blocker",
        title: `${sourceName} has no selected rows`,
        detail: "Select only rows that contain real records or items. Exclude headers, section labels, blank rows, signatures, subtotals, and totals.",
      });
    }

    if (!source.fields.length) {
      blockers.push({
        id: `source-${source.id}-fields`,
        sourceId: source.id,
        severity: "blocker",
        title: `${sourceName} has no mapped fields`,
        detail: "Map the spreadsheet columns that matter for validation, such as Item Description, Quantity, Unit Cost, or Total Cost. Use the header preview to choose the correct column.",
      });
    }

    if (!preview) {
      warnings.push({
        id: `source-${source.id}-preview`,
        sourceId: source.id,
        severity: "warning",
        title: `${sourceName} preview is not loaded in this view`,
        detail: "Reload the preview if row setup or worksheet selection changed, or if you want to visually re-check the header and data rows before running.",
      });
    }

    addSelectedRowContentWarnings(source, preview, warnings);
  }

  if (!enabledRules.length) {
    blockers.push({
      id: "enabled-rules",
      severity: "blocker",
      title: "No enabled rules",
      detail: "Enable or create at least one rule before running validation. Start with a direct comparison rule for important fields like description, quantity, unit cost, or total cost.",
    });
  }

  for (const rule of rules) {
    addRuleBlockers(rule, blockers);
  }

  const summary: PreflightSummary = {
    files: fileCount,
    sources: dataSources.length,
    selectedRows: dataSources.reduce((total, source) => total + source.selected_row_numbers.length, 0),
    mappedFields: dataSources.reduce((total, source) => total + source.fields.length, 0),
    enabledRules: enabledRules.length,
  };

  const status: PreflightSeverity = blockers.length ? "blocker" : warnings.length ? "warning" : "ready";

  return {
    status,
    blockers,
    warnings,
    summary,
    canRun: blockers.length === 0,
  };
}

export function preflightErrorMessage(review: PreflightReview) {
  if (review.canRun) return "";
  const first = review.blockers[0];
  const extra = review.blockers.length > 1 ? ` There are ${review.blockers.length - 1} more item(s) to fix.` : "";
  return first ? `${first.title}. ${first.detail}${extra}` : "Review the setup before running validation.";
}
