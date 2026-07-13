import type { ComparisonDataSource, ComparisonRule, DataSourcePreview, PresetType } from "../../types/validation.types";

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
        detail: "Confirm the header row and first data row in the visual row setup step.",
      });
    }

    if (!source.selected_row_numbers.length) {
      blockers.push({
        id: `source-${source.id}-rows`,
        sourceId: source.id,
        severity: "blocker",
        title: `${sourceName} has no selected rows`,
        detail: "Select the real data rows that should be included in validation.",
      });
    }

    if (!source.fields.length) {
      blockers.push({
        id: `source-${source.id}-fields`,
        sourceId: source.id,
        severity: "blocker",
        title: `${sourceName} has no mapped fields`,
        detail: "Map at least one column field for this source.",
      });
    }

    if (!preview) {
      warnings.push({
        id: `source-${source.id}-preview`,
        sourceId: source.id,
        severity: "warning",
        title: `${sourceName} preview is not loaded in this view`,
        detail: "Reload the preview if you want to visually re-check rows before running.",
      });
    }

    if (source.selected_row_numbers.some((row) => row <= source.header_row)) {
      warnings.push({
        id: `source-${source.id}-header-selected`,
        sourceId: source.id,
        severity: "warning",
        title: `${sourceName} may include header/non-data rows`,
        detail: "One or more selected rows are at or above the header row. Review row selection before running.",
      });
    }
  }

  if (!enabledRules.length) {
    blockers.push({
      id: "enabled-rules",
      severity: "blocker",
      title: "No enabled rules",
      detail: "Enable or create at least one rule before running validation.",
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
