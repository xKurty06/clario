import {
  AlertTriangle,
  Columns3,
  Database,
  Edit3,
  FileSpreadsheet,
  ListChecks,
  LoaderCircle,
  Plus,
  Play,
  RefreshCw,
  Rows3,
  Settings2,
  SlidersHorizontal,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "../components/common/EmptyState";
import { StatusBadge } from "../components/common/StatusBadge";
import { FieldLabel } from "../components/forms/FieldLabel";
import { HelpTip } from "../components/forms/HelpTip";
import { SelectField } from "../components/forms/SelectField";
import { PageHeader } from "../components/layout/PageHeader";
import { BuilderDrawer } from "../components/validation/BuilderDrawer";
import { BuilderStepper, type BuilderStep } from "../components/validation/BuilderStepper";
import { ColumnPicker } from "../components/validation/ColumnPicker";
import { RowSelectionTable } from "../components/validation/RowSelectionTable";
import { useWorkflow } from "../features/files/WorkflowContext";
import { useDraftEditor } from "../hooks/useDraftEditor";
import { checkBackendHealth } from "../services/apiClient";
import { previewDataSource } from "../services/fileApi";
import { runValidation } from "../services/validationApi";
import type { UploadedFile } from "../types/file.types";
import type {
  ComparisonDataSource,
  ComparisonField,
  ComparisonRule,
  DataSourcePreview,
  FieldType,
  FormulaSettings,
  MatchStrategy,
  PresetType,
  RuleStrictness,
  RuleType,
  Severity,
} from "../types/validation.types";
import { fieldTypeForLabel } from "../utils/fieldSuggestions";

type BuilderStepId = "sources" | "rows" | "fields" | "rules" | "review";
type EditorMode = "create" | "edit";

interface SourceEditorState {
  mode: EditorMode;
  initial: ComparisonDataSource;
  preview?: DataSourcePreview;
}

interface FieldEditorState {
  mode: EditorMode;
  sourceId: string;
  initial: ComparisonField;
  preview?: DataSourcePreview;
}

interface RuleEditorState {
  mode: EditorMode;
  initial: ComparisonRule;
}

interface ConfirmDialogState {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "danger" | "default";
  onConfirm: () => void;
}

const presetNames: Record<PresetType, string[]> = {
  reference_vs_copied: ["Reference", "Copied file"],
  reference_bidder_abstract: ["Reference", "Bidder", "Abstract"],
  generic_two_file: ["File A", "File B"],
  custom_comparison_builder: [],
};

const ruleTypeLabels: Record<RuleType, string> = {
  compare_values: "Compare two fields",
  formula_check: "Formula check",
  required_field_check: "Required field check",
  duplicate_check: "Duplicate check",
};

const matchLabels: Record<MatchStrategy, string> = {
  by_row_order: "By row order",
  by_item_number_field: "By item number field",
  by_exact_text_field: "By exact text field",
  by_multiple_fields: "By multiple fields",
  manual_placeholder: "Manual placeholder",
};

const strictnessLabels: Record<RuleStrictness, string> = {
  exact: "Exact",
  normalized_exact: "Exact text, ignore case",
  numeric_tolerance: "Numeric tolerance",
  currency_tolerance: "Currency tolerance",
};

const fieldTypeLabels: Record<FieldType, string> = {
  text: "Text",
  number: "Number",
  currency: "Currency",
  date: "Date",
  boolean: "Boolean",
  raw: "Raw value",
};

const severityLabels: Record<Severity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const formulaOperatorLabels: Record<FormulaSettings["operator"], string> = {
  add: "Add",
  subtract: "Subtract",
  multiply: "Multiply",
  divide: "Divide",
};

const primaryButtonClass = "inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300";
const secondaryButtonClass = "inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50";
const iconButtonClass = "grid size-9 place-items-center rounded-xl border border-transparent text-slate-500 transition hover:border-slate-200 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600";

function isValidPreset(value: string): value is PresetType {
  return value === "reference_vs_copied" || value === "reference_bidder_abstract" || value === "generic_two_file" || value === "custom_comparison_builder";
}

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function sourceName(file: UploadedFile, index: number) {
  return `Source ${index + 1} - ${file.name}`;
}

function createDataSource(file: UploadedFile, index: number): ComparisonDataSource {
  const sheet = file.sheets[0];
  const headerRow = sheet?.detected_header_row ?? 1;
  return {
    id: makeId("source"),
    name: sourceName(file, index),
    file_id: file.id,
    file_name: file.name,
    sheet_name: sheet?.name ?? "",
    header_row: headerRow,
    first_data_row: headerRow + 1,
    selected_row_numbers: [],
    ignored_row_numbers: [],
    row_selection_mode: "auto_detected",
    fields: [],
  };
}

function scaffoldSources(files: UploadedFile[]) {
  return files.slice(0, Math.max(1, Math.min(3, files.length))).map((file, index) => createDataSource(file, index));
}

function fieldTypeForName(fieldName: string): FieldType {
  return fieldTypeForLabel(fieldName);
}

function createFieldDraft(source: ComparisonDataSource, preview: DataSourcePreview) {
  const column = preview.columns.find((item) => !source.fields.some((field) => field.column_letter === item.letter)) ?? preview.columns[0];
  if (!column) return null;
  return {
    id: makeId("field"),
    data_source_id: source.id,
    field_name: `Field ${source.fields.length + 1}`,
    field_type: "text" as FieldType,
    column_letter: column.letter,
    original_header_label: column.header_label,
    custom_display_name: null,
    required: true,
    normalization: { case_insensitive: true, trim_whitespace: true, collapse_whitespace: true },
  };
}

function createRuleDraft(dataSources: ComparisonDataSource[], ruleCount: number): ComparisonRule | null {
  const leftSource = dataSources.find((source) => source.fields.length > 0) ?? dataSources[0];
  const rightSource = dataSources.find((source) => source.id !== leftSource?.id && source.fields.length > 0) ?? dataSources.find((source) => source.id !== leftSource?.id) ?? leftSource;
  const leftField = leftSource?.fields[0];
  const rightField = rightSource?.fields[0];
  if (!leftSource || !leftField) return null;
  return {
    id: makeId("rule"),
    rule_name: `Rule ${ruleCount + 1}`,
    rule_type: "compare_values",
    left_data_source_id: leftSource.id,
    left_field_id: leftField.id,
    right_data_source_id: rightSource?.id ?? null,
    right_field_id: rightField?.id ?? null,
    left_match_field_ids: [leftField.id],
    right_match_field_ids: rightField ? [rightField.id] : [],
    match_strategy: "by_row_order",
    strictness: "normalized_exact",
    numeric_tolerance: null,
    currency_tolerance: null,
    formula_settings: null,
    severity: "medium",
    enabled: true,
  };
}

function fieldLabel(field?: ComparisonField | null) {
  return field?.custom_display_name || field?.field_name || "Not selected";
}

function normalizedFieldName(field: ComparisonField) {
  return fieldLabel(field).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function suggestedRuleStrictness(field: ComparisonField): RuleStrictness {
  if (field.field_type === "currency") return "currency_tolerance";
  if (field.field_type === "number") return "exact";
  return "normalized_exact";
}

function suggestedRuleSeverity(field: ComparisonField) {
  const name = normalizedFieldName(field);
  return name.includes("description") || name.includes("desc") ? "high" : "medium";
}

function findSuggestedMatchKey(left: ComparisonDataSource, right: ComparisonDataSource, comparedFieldKey: string) {
  const keyPriority = ["itemnumber", "itemno", "sku", "productcode", "quoteref", "line"];
  for (const key of keyPriority) {
    const leftField = left.fields.find((field) => normalizedFieldName(field).includes(key));
    const rightField = right.fields.find((field) => normalizedFieldName(field) === normalizedFieldName(leftField ?? field));
    if (leftField && rightField && normalizedFieldName(leftField) !== comparedFieldKey) {
      return { leftField, rightField };
    }
  }
  return null;
}

function ruleLabel(rule: ComparisonRule, sources: ComparisonDataSource[]) {
  const left = sources.find((source) => source.id === rule.left_data_source_id);
  const right = sources.find((source) => source.id === rule.right_data_source_id);
  const leftField = left?.fields.find((field) => field.id === rule.left_field_id);
  const rightField = right?.fields.find((field) => field.id === rule.right_field_id);
  if (rule.rule_type === "formula_check") return `${left?.name ?? "Source"} formula`;
  if (rule.rule_type === "required_field_check") return `${fieldLabel(leftField)} is required`;
  if (rule.rule_type === "duplicate_check") return `${fieldLabel(leftField)} is unique`;
  return `${fieldLabel(leftField)} vs ${fieldLabel(rightField)}`;
}

function makeCompareRule(left: ComparisonDataSource, right: ComparisonDataSource, leftField: ComparisonField, rightField: ComparisonField): ComparisonRule {
  const fieldName = fieldLabel(leftField);
  const fieldKey = normalizedFieldName(leftField);
  const matchKey = findSuggestedMatchKey(left, right, fieldKey);
  const leftKey = matchKey?.leftField ?? leftField;
  const rightKey = matchKey?.rightField ?? rightField;
  const strictness = suggestedRuleStrictness(leftField);
  return {
    id: makeId("rule"),
    rule_name: `${fieldName} comparison`,
    rule_type: "compare_values",
    left_data_source_id: left.id,
    left_field_id: leftField.id,
    right_data_source_id: right.id,
    right_field_id: rightField.id,
    left_match_field_ids: [leftKey.id],
    right_match_field_ids: [rightKey.id],
    match_strategy: leftKey.id === leftField.id ? "by_row_order" : "by_item_number_field",
    strictness,
    numeric_tolerance: null,
    currency_tolerance: strictness === "currency_tolerance" ? "0.01" : null,
    formula_settings: null,
    severity: suggestedRuleSeverity(leftField),
    enabled: true,
  };
}

function normalizedCellValue(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  const numeric = raw.replace(/[$,%\s,]+/g, "");
  if (numeric && !Number.isNaN(Number(numeric))) return String(Number(numeric));
  return raw.toLowerCase().replace(/\s+/g, " ").replace(/[^\p{L}\p{N}. -]+/gu, "").trim();
}

function previewRowsForSource(source: ComparisonDataSource, preview?: DataSourcePreview) {
  if (!preview) return [];
  const selectedRows = new Set(source.selected_row_numbers);
  return preview.rows
    .filter((row) => {
      if (row.ignored || source.ignored_row_numbers.includes(row.row_number)) return false;
      if (selectedRows.size) return selectedRows.has(row.row_number);
      return row.selected || row.row_number >= source.first_data_row;
    })
    .sort((leftRow, rightRow) => leftRow.row_number - rightRow.row_number);
}

function previewCellValueForField(row: DataSourcePreview["rows"][number], preview: DataSourcePreview, field: ComparisonField) {
  const column = preview.columns.find((item) => item.letter.toUpperCase() === field.column_letter.toUpperCase());
  return row.cells[column?.header_label ?? field.column_letter] ?? row.cells[field.column_letter] ?? null;
}

function valuesForField(source: ComparisonDataSource, preview: DataSourcePreview | undefined, field: ComparisonField, keepEmpty = false) {
  if (!preview) return [];
  const values = previewRowsForSource(source, preview).map((row) => normalizedCellValue(previewCellValueForField(row, preview, field)));
  return keepEmpty ? values : values.filter(Boolean);
}

function countOverlappingValues(leftValues: string[], rightValues: string[]) {
  const rightCounts = new Map<string, number>();
  for (const value of rightValues) {
    rightCounts.set(value, (rightCounts.get(value) ?? 0) + 1);
  }

  let matches = 0;
  for (const value of leftValues) {
    const count = rightCounts.get(value) ?? 0;
    if (count <= 0) continue;
    matches += 1;
    rightCounts.set(value, count - 1);
  }
  return matches;
}

function scoreFieldValueMatch(
  left: ComparisonDataSource,
  right: ComparisonDataSource,
  leftPreview: DataSourcePreview | undefined,
  rightPreview: DataSourcePreview | undefined,
  leftField: ComparisonField,
  rightField: ComparisonField,
) {
  const alignedLeftValues = valuesForField(left, leftPreview, leftField, true);
  const alignedRightValues = valuesForField(right, rightPreview, rightField, true);
  const leftValues = alignedLeftValues.filter(Boolean);
  const rightValues = alignedRightValues.filter(Boolean);
  const comparableRows = Math.min(alignedLeftValues.length, alignedRightValues.length);
  if (!comparableRows) return 0;

  const alignedComparisons = alignedLeftValues
    .slice(0, comparableRows)
    .map((value, index) => [value, alignedRightValues[index]] as const)
    .filter(([leftValue, rightValue]) => leftValue && rightValue);
  const alignedMatches = alignedComparisons.filter(([leftValue, rightValue]) => leftValue === rightValue).length;
  const overlapMatches = countOverlappingValues(leftValues, rightValues);
  const alignedRatio = alignedComparisons.length ? alignedMatches / alignedComparisons.length : 0;
  const overlapRatio = overlapMatches / Math.max(1, Math.min(leftValues.length, rightValues.length));
  const uniqueMatches = new Set(leftValues.filter((value) => rightValues.includes(value))).size;
  const enoughAlignedMatches = alignedMatches >= 1 && alignedRatio >= 0.25;
  const enoughOverlappingMatches = overlapMatches >= 1 && overlapRatio >= 0.25 && uniqueMatches >= 1;

  if (!enoughAlignedMatches && !enoughOverlappingMatches) return 0;
  return Math.max(alignedRatio, overlapRatio * 0.85);
}

function buildCompareRulesForMatchingFields(
  left: ComparisonDataSource,
  right: ComparisonDataSource,
  leftPreview?: DataSourcePreview,
  rightPreview?: DataSourcePreview,
) {
  const rightFieldsByName = new Map<string, ComparisonField>();
  for (const field of right.fields) {
    const key = normalizedFieldName(field);
    if (key && !rightFieldsByName.has(key)) {
      rightFieldsByName.set(key, field);
    }
  }

  const matchedLeftFieldIds = new Set<string>();
  const matchedRightFieldIds = new Set<string>();
  const rules: ComparisonRule[] = [];

  for (const leftField of left.fields) {
    const rightField = rightFieldsByName.get(normalizedFieldName(leftField));
    if (!rightField || matchedRightFieldIds.has(rightField.id)) continue;
    matchedLeftFieldIds.add(leftField.id);
    matchedRightFieldIds.add(rightField.id);
    rules.push(makeCompareRule(left, right, leftField, rightField));
  }

  const candidates = left.fields
    .filter((leftField) => !matchedLeftFieldIds.has(leftField.id))
    .flatMap((leftField) =>
      right.fields
        .filter((rightField) => !matchedRightFieldIds.has(rightField.id))
        .map((rightField) => ({
          leftField,
          rightField,
          score: scoreFieldValueMatch(left, right, leftPreview, rightPreview, leftField, rightField),
        }))
        .filter((candidate) => candidate.score > 0),
    )
    .sort((leftCandidate, rightCandidate) => rightCandidate.score - leftCandidate.score);

  for (const candidate of candidates) {
    if (matchedLeftFieldIds.has(candidate.leftField.id) || matchedRightFieldIds.has(candidate.rightField.id)) continue;
    matchedLeftFieldIds.add(candidate.leftField.id);
    matchedRightFieldIds.add(candidate.rightField.id);
    rules.push(makeCompareRule(left, right, candidate.leftField, candidate.rightField));
  }

  return rules;
}

function ruleIsRunnable(rule: ComparisonRule) {
  if (!rule.enabled) return true;
  if (rule.rule_type === "compare_values") return Boolean(rule.left_data_source_id && rule.left_field_id && rule.right_data_source_id && rule.right_field_id);
  if (rule.rule_type === "formula_check") return Boolean(rule.left_data_source_id && rule.formula_settings?.operand_field_ids.length === 2 && rule.formula_settings.result_field_id);
  return Boolean(rule.left_data_source_id && rule.left_field_id);
}

function ruleSuggestionKey(rule: ComparisonRule) {
  return [
    rule.rule_type,
    rule.left_data_source_id ?? "",
    rule.left_field_id ?? "",
    rule.right_data_source_id ?? "",
    rule.right_field_id ?? "",
    rule.match_strategy,
    [...rule.left_match_field_ids].sort().join(","),
    [...rule.right_match_field_ids].sort().join(","),
  ].join("|");
}

function sourceConfigSignature(source: ComparisonDataSource) {
  return [source.file_id, source.sheet_name, source.header_row, source.first_data_row].join("|");
}

function validateSource(source: ComparisonDataSource, files: UploadedFile[]) {
  const errors: string[] = [];
  const file = files.find((item) => item.id === source.file_id);
  const hasSheet = file?.sheets.some((sheet) => sheet.name === source.sheet_name);
  if (!source.name.trim()) errors.push("Source name is required.");
  if (!source.file_id || !file) errors.push("File is required.");
  if (!source.sheet_name || !hasSheet) errors.push("Sheet is required.");
  if (!Number.isInteger(source.header_row) || source.header_row < 1) errors.push("Header row must be 1 or greater.");
  if (!Number.isInteger(source.first_data_row) || source.first_data_row <= source.header_row) errors.push("First data row must be greater than the header row.");
  return errors;
}

function validateField(field: ComparisonField, preview?: DataSourcePreview) {
  const errors: string[] = [];
  if (!field.field_name.trim()) errors.push("Field name is required.");
  if (!field.field_type) errors.push("Field type is required.");
  if (!preview) errors.push("Preview rows for this source before choosing a column.");
  if (!field.column_letter) errors.push("Column is required.");
  return errors;
}

function validateRule(rule: ComparisonRule) {
  const errors: string[] = [];
  if (!rule.rule_name.trim()) errors.push("Rule name is required.");
  if (!rule.rule_type) errors.push("Rule type is required.");
  if (rule.rule_type === "compare_values" && !(rule.left_data_source_id && rule.left_field_id && rule.right_data_source_id && rule.right_field_id)) {
    errors.push("Choose both the expected and actual source fields.");
  }
  if (rule.rule_type === "formula_check") {
    const formula = rule.formula_settings;
    if (!(rule.left_data_source_id && formula?.operand_field_ids?.[0] && formula?.operand_field_ids?.[1] && formula.result_field_id && formula.operator)) {
      errors.push("Formula rules need a source, two operand fields, an operator, and a result field.");
    }
  }
  if ((rule.rule_type === "required_field_check" || rule.rule_type === "duplicate_check") && !(rule.left_data_source_id && rule.left_field_id)) {
    errors.push("Choose the source and field to check.");
  }
  if (rule.strictness === "numeric_tolerance" && !rule.numeric_tolerance) errors.push("Numeric tolerance is required for numeric tolerance checks.");
  if (rule.strictness === "currency_tolerance" && !rule.currency_tolerance) errors.push("Currency tolerance is required for currency tolerance checks.");
  return errors;
}

function describeFieldDependencies(rules: ComparisonRule[], fieldId: string) {
  const dependentRules = rules.filter((rule) =>
    rule.left_field_id === fieldId ||
    rule.right_field_id === fieldId ||
    rule.left_match_field_ids.includes(fieldId) ||
    rule.right_match_field_ids.includes(fieldId) ||
    rule.formula_settings?.operand_field_ids.includes(fieldId) ||
    rule.formula_settings?.result_field_id === fieldId,
  );
  return dependentRules.length;
}

function describeSourceDependencies(rules: ComparisonRule[], sourceId: string) {
  return rules.filter((rule) => rule.left_data_source_id === sourceId || rule.right_data_source_id === sourceId).length;
}

function titleCaseStrictness(strictness: RuleStrictness) {
  return strictnessLabels[strictness];
}

interface ComparisonBuilderPageProps {
  onBackToRowSetup?: () => void;
}

export function ComparisonBuilderPage({ onBackToRowSetup }: ComparisonBuilderPageProps) {
  const navigate = useNavigate();
  const {
    files,
    preset,
    projectName,
    dataSources,
    setDataSources,
    updateDataSource,
    removeDataSource,
    sourcePreviews,
    setSourcePreview,
    removeSourcePreview,
    rules,
    setRules,
    updateRule,
    removeRule,
    result,
    setResult,
  } = useWorkflow();
  const [activeStep, setActiveStep] = useState<BuilderStepId>("sources");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [presetDecision, setPresetDecision] = useState<"pending" | "applied" | "manual">("pending");
  const [sourceEditor, setSourceEditor] = useState<SourceEditorState | null>(null);
  const [fieldEditor, setFieldEditor] = useState<FieldEditorState | null>(null);
  const [ruleEditor, setRuleEditor] = useState<RuleEditorState | null>(null);
  const [ruleSuggestions, setRuleSuggestions] = useState<ComparisonRule[] | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  useEffect(() => {
    if (!files.length || dataSources.length) return;
    setDataSources(scaffoldSources(files));
  }, [files, dataSources.length, setDataSources]);

  const fieldsBySource = useMemo(() => Object.fromEntries(dataSources.map((source) => [source.id, source.fields])), [dataSources]);

  const warnings = useMemo(() => {
    const items: string[] = [];
    if (!isValidPreset(preset)) items.push("Choose a comparison preset before running validation.");
    for (const source of dataSources) {
      if (!sourcePreviews[source.id]) items.push(`${source.name} has no row preview yet.`);
      if (!source.selected_row_numbers.length) items.push(`${source.name} has zero selected rows.`);
      if (!source.fields.length) items.push(`${source.name} has no fields.`);
    }
    if (!rules.some((rule) => rule.enabled)) items.push("No enabled rules.");
    for (const rule of rules) {
      if (!ruleIsRunnable(rule)) items.push(`${rule.rule_name} is incomplete.`);
    }
    return items;
  }, [dataSources, preset, rules, sourcePreviews]);

  const enabledRules = rules.filter((rule) => rule.enabled);
  const canRun =
    isValidPreset(preset) &&
    dataSources.length > 0 &&
    enabledRules.length > 0 &&
    warnings.every((warning) => !warning.includes("zero selected rows") && !warning.includes("no fields") && !warning.includes("No enabled") && !warning.includes("incomplete") && !warning.includes("Choose a comparison preset"));

  const steps: BuilderStep[] = [
    { id: "sources", label: "Sources", icon: Database, complete: dataSources.length > 0 },
    { id: "rows", label: "Rows", icon: Rows3, complete: dataSources.every((source) => source.selected_row_numbers.length > 0), warning: dataSources.some((source) => !source.selected_row_numbers.length) },
    { id: "fields", label: "Fields", icon: Columns3, complete: dataSources.every((source) => source.fields.length > 0), warning: dataSources.some((source) => !source.fields.length) },
    { id: "rules", label: "Rules", icon: ListChecks, complete: enabledRules.length > 0 && rules.every(ruleIsRunnable), warning: enabledRules.length === 0 || !rules.every(ruleIsRunnable) },
    { id: "review", label: "Review & Run", icon: Play, complete: canRun, warning: !canRun },
  ];

  if (!files.length) {
    return (
      <div>
        <PageHeader eyebrow="Step 2 of 4" title="Comparison builder" description="Upload files before creating sources, rows, fields, and rules." />
        <div className="pt-8">
          <EmptyState icon={Database} title="No files uploaded" description="Return to Upload files and inspect at least one spreadsheet." />
        </div>
      </div>
    );
  }

  const refreshPreview = async (source: ComparisonDataSource) => {
    setBusy(source.id);
    setError("");
    try {
      const preview = await previewDataSource(source);
      updateDataSource(source.id, preview.data_source);
      setSourcePreview(source.id, preview);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not preview this source.");
    } finally {
      setBusy(null);
    }
  };

  const setRowsForSource = (source: ComparisonDataSource, preview: DataSourcePreview, selectedRows: number[], ignoredRows = source.ignored_row_numbers) => {
    const selected = [...new Set(selectedRows)].sort((a, b) => a - b);
    const ignored = [...new Set(ignoredRows)].sort((a, b) => a - b);
    updateDataSource(source.id, { ...source, selected_row_numbers: selected, ignored_row_numbers: ignored, row_selection_mode: "manual_include" });
    setSourcePreview(source.id, {
      ...preview,
      rows: preview.rows.map((row) => ({ ...row, selected: selected.includes(row.row_number), ignored: ignored.includes(row.row_number) })),
    });
  };

  const openCreateSource = () => {
    const file = files[0];
    if (!file) return;
    setSourceEditor({ mode: "create", initial: createDataSource(file, dataSources.length) });
  };

  const openEditSource = (source: ComparisonDataSource) => {
    setSourceEditor({ mode: "edit", initial: source, preview: sourcePreviews[source.id] });
  };

  const openCreateField = (source: ComparisonDataSource) => {
    const preview = sourcePreviews[source.id];
    if (!preview) return;
    const initial = createFieldDraft(source, preview);
    if (!initial) return;
    setFieldEditor({ mode: "create", sourceId: source.id, initial, preview });
  };

  const openEditField = (source: ComparisonDataSource, field: ComparisonField) => {
    setFieldEditor({ mode: "edit", sourceId: source.id, initial: field, preview: sourcePreviews[source.id] });
  };

  const openCreateRule = () => {
    const initial = createRuleDraft(dataSources, rules.length);
    if (!initial) return;
    setRuleEditor({ mode: "create", initial });
  };

  const openEditRule = (rule: ComparisonRule) => {
    setRuleEditor({ mode: "edit", initial: rule });
  };

  const saveSource = (nextSource: ComparisonDataSource, preview?: DataSourcePreview | null) => {
    if (!sourceEditor) return;
    const configChanged = sourceConfigSignature(sourceEditor.initial) !== sourceConfigSignature(nextSource);
    if (sourceEditor.mode === "create") {
      setDataSources([...dataSources, nextSource]);
    } else {
      updateDataSource(nextSource.id, nextSource);
    }

    if (preview) {
      setSourcePreview(nextSource.id, preview);
    } else if (configChanged) {
      removeSourcePreview(nextSource.id);
    }

    setSourceEditor(null);
  };

  const saveField = (nextField: ComparisonField) => {
    if (!fieldEditor) return;
    const source = dataSources.find((item) => item.id === fieldEditor.sourceId);
    if (!source) return;
    if (fieldEditor.mode === "create") {
      updateDataSource(source.id, { ...source, fields: [...source.fields, nextField] });
    } else {
      updateDataSource(source.id, { ...source, fields: source.fields.map((field) => (field.id === nextField.id ? nextField : field)) });
    }
    setFieldEditor(null);
  };

  const saveRule = (nextRule: ComparisonRule) => {
    if (!ruleEditor) return;
    if (ruleEditor.mode === "create") {
      setRules([...rules, nextRule]);
    } else {
      updateRule(nextRule.id, nextRule);
    }
    setRuleEditor(null);
  };

  const requestConfirm = (state: ConfirmDialogState) => {
    setConfirmDialog(state);
  };

  const applyPresetSetup = () => {
    if (!isValidPreset(preset)) return;
    const labels = presetNames[preset];
    const count = labels.length || Math.min(2, files.length);
    const next = [...dataSources];
    for (let index = 0; index < count; index += 1) {
      const file = files[index] ?? files[0];
      if (!file) continue;
      const current = next[index] ?? createDataSource(file, index);
      next[index] = { ...current, name: labels[index] ? `${labels[index]} - ${current.file_name ?? file.name}` : sourceName(file, index) };
    }
    setDataSources(next);
    setPresetDecision("applied");
  };

  const buildSuggestedRules = () => {
    if (dataSources.length < 2) return;
    const left = dataSources[0];
    const right = dataSources[dataSources.length - 1];
    if (!left || !right) return;
    const next = buildCompareRulesForMatchingFields(left, right, sourcePreviews[left.id], sourcePreviews[right.id]);
    if (!next.length) {
      setError("No matching field names or preview values were found across the first and last sources. Map matching fields before building suggested rules.");
      return;
    }
    setError("");
    setRuleSuggestions(next);
  };

  const addSuggestedRules = (selectedRules: ComparisonRule[]) => {
    const existingKeys = new Set(rules.map(ruleSuggestionKey));
    const additions = selectedRules.filter((rule) => !existingKeys.has(ruleSuggestionKey(rule)));
    if (!additions.length) {
      setRuleSuggestions(null);
      setError("Selected suggested rules are already in the rule list.");
      return;
    }
    setRules([...rules, ...additions]);
    setRuleSuggestions(null);
    setError("");
  };

  const run = async () => {
    setBusy("validation");
    setError("");
    try {
      if (!isValidPreset(preset)) {
        setError("Please choose a comparison preset before running validation.");
        return;
      }
      await checkBackendHealth();
      const result = await runValidation({ project_name: projectName, preset, data_sources: dataSources, rules });
      setResult(result);
      navigate("/results");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Validation failed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Step 2 of 4"
        title="Comparison builder"
        description="Build flexible sources, rows, fields, and rules in a guided desktop workflow."
        action={
          <button
            onClick={openCreateSource}
            title="Add a new comparison source without committing it until you click Create source"
            aria-label="Add source"
            className={primaryButtonClass}
          >
            <Plus className="size-4" /> Add source
          </button>
        }
      />

      <div className="space-y-6 pt-6 pb-24 lg:pb-28">
        <BuilderStepper steps={steps} activeStep={activeStep} onStepChange={(step) => setActiveStep(step as BuilderStepId)} />
        {error ? <p className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        {presetDecision === "pending" && isValidPreset(preset) && preset !== "custom_comparison_builder" ? (
          <section className="rounded-3xl border border-emerald-100 bg-[linear-gradient(135deg,_rgba(16,185,129,0.12),_rgba(255,255,255,0.95)_55%)] p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-emerald-950">Preset setup available</p>
                <p className="mt-1 text-sm text-emerald-800">This preset can suggest source labels and starter checks. Uploaded files keep neutral names until you apply it.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button title="Apply preset setup to suggest source labels and starter checks" onClick={applyPresetSetup} className={primaryButtonClass}>
                  <Wand2 className="size-4" /> Apply preset setup
                </button>
                <button title="Skip preset suggestions and continue setting up the builder manually" onClick={() => setPresetDecision("manual")} className={secondaryButtonClass}>
                  Start manually
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {activeStep === "sources" ? (
          <section className="space-y-4">
            {onBackToRowSetup ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div>
                  <p className="text-sm font-semibold text-slate-950">Row setup review</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Use the visual row setup screen to confirm header and first data rows across every source.
                  </p>
                </div>
                <button type="button" onClick={onBackToRowSetup} className={secondaryButtonClass} title="Return to the visual row setup review">
                  <Rows3 className="size-4" /> Review row setup
                </button>
              </div>
            ) : null}
            <div className="grid gap-4 lg:grid-cols-2">
              {dataSources.map((source) => {
                const preview = sourcePreviews[source.id];
                const dependentRules = describeSourceDependencies(rules, source.id);
                return (
                  <article key={source.id} className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 gap-y-1">
                          <h2 className="truncate text-base font-semibold text-slate-950">{source.name}</h2>
                          {preview ? <StatusBadge tone="success">Preview ready</StatusBadge> : <StatusBadge tone="warning">Needs preview</StatusBadge>}
                        </div>
                        <p className="mt-1 truncate text-sm text-slate-500">{source.file_name ?? "No file"} / {source.sheet_name || "No sheet"}</p>
                      </div>
                      <div className="flex gap-2">
                        <button title="Edit source settings in a draft drawer before saving" aria-label={`Edit source ${source.name}`} onClick={() => openEditSource(source)} className={iconButtonClass}>
                          <Edit3 className="size-4" />
                        </button>
                        <button
                          title="Delete this source from the comparison builder"
                          aria-label={`Delete source ${source.name}`}
                          onClick={() => {
                            const warning = dependentRules
                              ? `Delete this source? ${dependentRules} rule(s) reference it and may become incomplete.`
                              : "Delete this source from the builder?";
                            requestConfirm({
                              title: "Delete source?",
                              description: warning,
                              confirmLabel: "Delete source",
                              tone: "danger",
                              onConfirm: () => {
                                removeDataSource(source.id);
                                removeSourcePreview(source.id);
                              },
                            });
                          }}
                          className={`${iconButtonClass} text-red-700 hover:border-red-100 hover:bg-red-50`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                    <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                      <Metric label="Header row" value={String(source.header_row)} />
                      <Metric label="First data row" value={String(source.first_data_row)} />
                      <Metric label="Selected rows" value={String(source.selected_row_numbers.length)} />
                      <Metric label="Fields" value={String(source.fields.length)} />
                    </dl>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        {activeStep === "rows" ? (
          <section className="space-y-5">
            {dataSources.map((source) => {
              const preview = sourcePreviews[source.id];
              if (!preview) {
                return (
                  <article key={source.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h2 className="font-semibold">{source.name}</h2>
                        <p className="mt-1 text-sm text-slate-500">Preview rows before selecting data rows.</p>
                      </div>
                      <button title="Preview rows for this source to enable row selection" onClick={() => refreshPreview(source)} className={secondaryButtonClass}>
                        Preview rows
                      </button>
                    </div>
                  </article>
                );
              }
              const headers = preview.columns.map((column) => column.header_label);
              const dataRows = preview.rows.filter((row) => row.row_number >= source.first_data_row);
              return (
                <article key={source.id} className="space-y-3">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <h2 className="font-semibold">{source.name}</h2>
                      <p className="mt-1 text-sm text-slate-500">{source.selected_row_numbers.length} selected / {source.ignored_row_numbers.length} ignored</p>
                    </div>
                  </div>
                  <RowSelectionTable
                    headers={headers}
                    rows={dataRows}
                    onToggleRow={(rowNumber) => {
                      const selected = source.selected_row_numbers.includes(rowNumber) ? source.selected_row_numbers.filter((item) => item !== rowNumber) : [...source.selected_row_numbers, rowNumber];
                      setRowsForSource(source, preview, selected);
                    }}
                    onSelectRows={(rowNumbers) => setRowsForSource(source, preview, rowNumbers)}
                    onIgnoreRows={(rowNumbers) => {
                      const ignored = [...new Set([...source.ignored_row_numbers, ...rowNumbers])];
                      setRowsForSource(source, preview, source.selected_row_numbers.filter((row) => !ignored.includes(row)), ignored);
                    }}
                    onMarkDataRows={(rowNumbers) => {
                      const ignored = source.ignored_row_numbers.filter((row) => !rowNumbers.includes(row));
                      setRowsForSource(source, preview, [...new Set([...source.selected_row_numbers, ...rowNumbers])], ignored);
                    }}
                  />
                </article>
              );
            })}
          </section>
        ) : null}

        {activeStep === "fields" ? (
          <section className="space-y-6">
            {dataSources.map((source) => {
              const preview = sourcePreviews[source.id];
              return (
                <article key={source.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="font-semibold">{source.name}</h2>
                      <p className="mt-1 text-sm text-slate-500">{source.fields.length} mapped field(s)</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        data-suggest-fields-source-id={source.id}
                        disabled={!preview}
                        title="Suggest field mappings from detected source headers"
                        onClick={() => window.dispatchEvent(new CustomEvent("clario:suggest-fields", { detail: { sourceId: source.id } }))}
                        className={secondaryButtonClass}
                      >
                        Add suggested fields
                      </button>
                      <button
                        disabled={!preview}
                        title="Add a field mapping in draft mode and only commit it when you click Create field"
                        onClick={() => openCreateField(source)}
                        className={primaryButtonClass}
                      >
                        <Plus className="size-4" /> Add field
                      </button>
                    </div>
                  </div>
                  {!preview ? <p className="mt-4 text-sm text-slate-500">Preview this source before adding fields.</p> : null}
                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {source.fields.map((field) => {
                      const dependentRules = describeFieldDependencies(rules, field.id);
                      return (
                        <div key={field.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{fieldLabel(field)}</p>
                              <p className="mt-1 text-xs text-slate-500">{fieldTypeLabels[field.field_type]} / column {field.column_letter}</p>
                            </div>
                            <div className="flex gap-2">
                              <button title="Edit field settings in a draft drawer before saving" aria-label={`Edit field ${fieldLabel(field)}`} onClick={() => openEditField(source, field)} className={`${iconButtonClass} size-8`}>
                                <Edit3 className="size-4" />
                              </button>
                              <button
                                title="Remove this field mapping from the source"
                                aria-label={`Remove field ${fieldLabel(field)}`}
                                onClick={() => {
                                  const warning = dependentRules
                                    ? `Remove this field? ${dependentRules} rule(s) using this field may become incomplete.`
                                    : "Remove this field mapping from the source?";
                                  requestConfirm({
                                    title: "Remove field?",
                                    description: warning,
                                    confirmLabel: "Remove field",
                                    tone: "danger",
                                    onConfirm: () => updateDataSource(source.id, { ...source, fields: source.fields.filter((item) => item.id !== field.id) }),
                                  });
                                }}
                                className={`${iconButtonClass} size-8 text-red-700 hover:border-red-100 hover:bg-red-50`}
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </div>
                          </div>
                          <p className="mt-3 truncate text-xs text-slate-500">{field.original_header_label || "Blank header"}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {field.required ? <StatusBadge tone="warning">Required</StatusBadge> : <StatusBadge>Optional</StatusBadge>}
                            {field.normalization.case_insensitive ? <StatusBadge>Ignore case</StatusBadge> : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </section>
        ) : null}

        {activeStep === "rules" ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Rules</h2>
                <p className="mt-1 text-sm text-slate-500">{enabledRules.length} enabled rule(s)</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button title="Build a starter set of comparison rules from the mapped source fields" onClick={buildSuggestedRules} className={secondaryButtonClass}>
                  Build suggested rules
                </button>
                <button title="Add a rule in draft mode and only commit it when you click Create rule" onClick={openCreateRule} className={primaryButtonClass} disabled={!dataSources.some((source) => source.fields.length)}>
                  <Plus className="size-4" /> Add rule
                </button>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {rules.map((rule) => {
                const left = dataSources.find((source) => source.id === rule.left_data_source_id);
                const right = dataSources.find((source) => source.id === rule.right_data_source_id);
                const leftField = left?.fields.find((field) => field.id === rule.left_field_id);
                const rightField = right?.fields.find((field) => field.id === rule.right_field_id);
                return (
                  <article key={rule.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 gap-y-1">
                          <h3 className="truncate text-sm font-semibold">{rule.rule_name || ruleLabel(rule, dataSources)}</h3>
                          <StatusBadge tone={rule.enabled ? "success" : "neutral"}>{rule.enabled ? "Enabled" : "Disabled"}</StatusBadge>
                          <StatusBadge tone={rule.severity === "high" ? "warning" : "neutral"}>{severityLabels[rule.severity]}</StatusBadge>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">{ruleTypeLabels[rule.rule_type]} / {matchLabels[rule.match_strategy]} / {titleCaseStrictness(rule.strictness)}</p>
                        <p className="mt-1 truncate text-xs text-slate-500">{left?.name ?? "Source"}: {fieldLabel(leftField)} {right ? `/ ${right.name}: ${fieldLabel(rightField)}` : ""}</p>
                      </div>
                      <div className="flex gap-2">
                        <button title="Edit rule settings in a draft drawer before saving" aria-label={`Edit rule ${rule.rule_name}`} onClick={() => openEditRule(rule)} className={iconButtonClass}>
                          <Edit3 className="size-4" />
                        </button>
                        <button
                          title="Remove this validation rule"
                          aria-label={`Remove rule ${rule.rule_name}`}
                          onClick={() => {
                            requestConfirm({
                              title: "Remove rule?",
                              description: "Remove this rule? This check will no longer run during validation.",
                              confirmLabel: "Remove rule",
                              tone: "danger",
                              onConfirm: () => removeRule(rule.id),
                            });
                          }}
                          className={`${iconButtonClass} text-red-700 hover:border-red-100 hover:bg-red-50`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
              {!rules.length ? <EmptyState icon={ListChecks} title="No rules yet" description="Add a rule or build suggested rules after fields are mapped." /> : null}
            </div>
          </section>
        ) : null}

        {activeStep === "review" ? (
          <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold">Review setup</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Summary label="Files uploaded" value={files.length} />
                <Summary label="Data sources" value={dataSources.length} />
                <Summary label="Selected rows" value={dataSources.reduce((total, source) => total + source.selected_row_numbers.length, 0)} />
                <Summary label="Enabled rules" value={enabledRules.length} />
              </div>
              <div className="mt-6 space-y-3">
                {dataSources.map((source) => (
                  <div key={source.id} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <FileSpreadsheet className="size-5 text-emerald-700" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{source.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{source.selected_row_numbers.length} rows / {source.fields.length} fields / {source.sheet_name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-600" />
                <h2 className="font-semibold">Warnings</h2>
              </div>
              <div className="mt-4 space-y-2">
                {warnings.length ? warnings.map((warning) => <p key={warning} className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">{warning}</p>) : <p className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-800">Setup is ready to validate.</p>}
              </div>
              <button title={`${result ? "Re-run" : "Run"} validation with the current sources, rows, fields, and rules`} disabled={!canRun || busy === "validation"} onClick={run} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
                {busy === "validation" ? <LoaderCircle className="size-4 animate-spin" /> : result ? <RefreshCw className="size-4" /> : <Play className="size-4" />}
                {busy === "validation" ? (result ? "Re-running validation..." : "Running validation...") : result ? "Re-run validation" : "Run validation"}
              </button>
            </aside>
          </section>
        ) : null}
      </div>

      <SourceDrawer
        files={files}
        editor={sourceEditor}
        open={Boolean(sourceEditor)}
        onClose={() => setSourceEditor(null)}
        onSave={saveSource}
        requestConfirm={requestConfirm}
      />
      <FieldDrawer
        editor={fieldEditor}
        source={fieldEditor ? dataSources.find((item) => item.id === fieldEditor.sourceId) ?? null : null}
        open={Boolean(fieldEditor)}
        onClose={() => setFieldEditor(null)}
        onSave={saveField}
        requestConfirm={requestConfirm}
      />
      <RuleDrawer
        editor={ruleEditor}
        sources={dataSources}
        fieldsBySource={fieldsBySource}
        open={Boolean(ruleEditor)}
        onClose={() => setRuleEditor(null)}
        onSave={saveRule}
        requestConfirm={requestConfirm}
      />
      <RuleSuggestionDialog
        suggestions={ruleSuggestions}
        existingRules={rules}
        sources={dataSources}
        onAdd={addSuggestedRules}
        onClose={() => setRuleSuggestions(null)}
      />
      <ConfirmationDialog state={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function RuleSuggestionDialog({
  suggestions,
  existingRules,
  sources,
  onAdd,
  onClose,
}: {
  suggestions: ComparisonRule[] | null;
  existingRules: ComparisonRule[];
  sources: ComparisonDataSource[];
  onAdd: (rules: ComparisonRule[]) => void;
  onClose: () => void;
}) {
  const existingKeys = useMemo(() => new Set(existingRules.map(ruleSuggestionKey)), [existingRules]);
  const availableSuggestions = useMemo(() => suggestions?.filter((rule) => !existingKeys.has(ruleSuggestionKey(rule))) ?? [], [existingKeys, suggestions]);
  const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([]);

  useEffect(() => {
    setSelectedRuleIds(availableSuggestions.map((rule) => rule.id));
  }, [availableSuggestions]);

  if (!suggestions) return null;

  const selectedRules = suggestions.filter((rule) => selectedRuleIds.includes(rule.id));
  const dialog = (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
      <button aria-label="Close suggested rules dialog" className="absolute inset-0 bg-slate-950/35 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="suggested-rules-title"
        className="relative max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl animate-[builder-dialog-in_180ms_cubic-bezier(0.16,1,0.3,1)_forwards]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Wand2 className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 id="suggested-rules-title" className="text-lg font-semibold text-slate-950">Choose rules to add</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Suggested rules use matching field names first, then preview row values when field names differ.
              </p>
            </div>
          </div>
          <button type="button" aria-label="Close" title="Close" onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">
            <X className="size-4" />
          </button>
        </div>

        <div className="max-h-[56vh] overflow-auto p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-500">{availableSuggestions.length} new of {suggestions.length} suggested rule{suggestions.length === 1 ? "" : "s"}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setSelectedRuleIds(availableSuggestions.map((rule) => rule.id))} className={secondaryButtonClass}>Select all new</button>
              <button type="button" onClick={() => setSelectedRuleIds([])} className={secondaryButtonClass}>Clear</button>
            </div>
          </div>

          <div className="space-y-3">
            {suggestions.map((rule) => {
              const isDuplicate = existingKeys.has(ruleSuggestionKey(rule));
              const checked = selectedRuleIds.includes(rule.id);
              const left = sources.find((source) => source.id === rule.left_data_source_id);
              const right = sources.find((source) => source.id === rule.right_data_source_id);
              const leftField = left?.fields.find((field) => field.id === rule.left_field_id);
              const rightField = right?.fields.find((field) => field.id === rule.right_field_id);
              return (
                <label
                  key={rule.id}
                  className={`flex gap-3 rounded-2xl border p-4 text-sm transition ${isDuplicate ? "border-slate-200 bg-slate-50 opacity-70" : checked ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}
                  title={isDuplicate ? "This suggested rule is already in the rule list" : `Add ${rule.rule_name}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={isDuplicate}
                    onChange={(event) => {
                      const nextChecked = event.target.checked;
                      setSelectedRuleIds((current) => nextChecked ? [...new Set([...current, rule.id])] : current.filter((id) => id !== rule.id));
                    }}
                    className="mt-1 size-4 rounded border-slate-300 accent-emerald-700"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-950">{rule.rule_name}</span>
                      <StatusBadge tone={rule.severity === "high" ? "warning" : "neutral"}>{severityLabels[rule.severity]}</StatusBadge>
                      {isDuplicate ? <StatusBadge tone="neutral">Already added</StatusBadge> : null}
                    </span>
                    <span className="mt-2 block text-xs leading-5 text-slate-600">
                      {left?.name ?? "Source"}: <span className="font-semibold text-slate-800">{fieldLabel(leftField)}</span>
                      {right ? <> / {right.name}: <span className="font-semibold text-slate-800">{fieldLabel(rightField)}</span></> : null}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                      {ruleTypeLabels[rule.rule_type]} / {matchLabels[rule.match_strategy]} / {titleCaseStrictness(rule.strictness)}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>

          {!availableSuggestions.length ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              All suggested rules are already in the rule list.
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 p-5">
          <div className="text-sm text-slate-500">
            {selectedRules.length} rule{selectedRules.length === 1 ? "" : "s"} selected
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={onClose} className={secondaryButtonClass}>Cancel</button>
            <button type="button" disabled={!selectedRules.length} onClick={() => onAdd(selectedRules)} className={primaryButtonClass}>
              Add selected rules
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}

function SourceDrawer({
  files,
  editor,
  open,
  onClose,
  onSave,
  requestConfirm,
}: {
  files: UploadedFile[];
  editor: SourceEditorState | null;
  open: boolean;
  onClose: () => void;
  onSave: (source: ComparisonDataSource, preview?: DataSourcePreview | null) => void;
  requestConfirm: (state: ConfirmDialogState) => void;
}) {
  const { draft, setDraft, dirty, reset } = useDraftEditor(editor?.initial ?? null);

  if (!editor || !draft) return null;
  const file = files.find((item) => item.id === draft.file_id) ?? files[0];
  const sheets = file?.sheets ?? [];
  const errors = validateSource(draft, files);
  const configChanged = sourceConfigSignature(editor.initial) !== sourceConfigSignature(draft);
  const footerMessage = errors[0] ?? (configChanged ? "Saving workbook or row-boundary changes clears the current preview. Review row setup from Step 1 or refresh rows in Step 2." : dirty ? "Save changes to update the source card and downstream workflow." : undefined);

  const updateDraft = (next: ComparisonDataSource) => {
    setDraft(next);
  };

  const handleCancel = () => {
    if (dirty) {
      requestConfirm({
        title: "Discard unsaved source changes?",
        description: "Your current source draft will be closed and the last saved version will remain unchanged.",
        confirmLabel: "Discard changes",
        tone: "danger",
        onConfirm: () => {
          reset();
          onClose();
        },
      });
      return;
    }
    reset();
    onClose();
  };

  const handleDiscard = () => {
    requestConfirm({
      title: "Discard source draft changes?",
      description: "This will throw away the current source edits and restore the last saved version.",
      confirmLabel: "Discard changes",
      tone: "danger",
      onConfirm: () => {
        reset();
        onClose();
      },
    });
  };

  return (
    <BuilderDrawer
      title={editor.mode === "create" ? "Create source" : "Edit source"}
      description="Choose the workbook section and row boundaries for this comparison source. Draft edits stay local until you save."
      icon={Database}
      open={open}
      dirty={dirty}
      onCancel={handleCancel}
      onDiscard={handleDiscard}
      onSave={() => onSave(draft)}
      saveLabel={editor.mode === "create" ? "Create source" : "Save changes"}
      disableSave={errors.length > 0}
      warningMessage={footerMessage}
    >
      <div className="space-y-5">
        <EditorSection title="Source identity" description="Name the source and choose which uploaded workbook section it should read from.">
          <TextInput
            label="Source name"
            help="A friendly name used in rules and reports. This does not rename the original file."
            value={draft.name}
            onChange={(value) => updateDraft({ ...draft, name: value })}
            error={!draft.name.trim() ? "Source name is required." : undefined}
          />
          <SelectInput
            label="File"
            help="Choose the uploaded workbook or CSV this source will read from."
            value={draft.file_id}
            options={files.map((item) => ({ value: item.id, label: item.name }))}
            onChange={(value) => {
              const nextFile = files.find((item) => item.id === value) ?? files[0];
              if (!nextFile) return;
              const nextSheet = nextFile.sheets[0];
              updateDraft({
                ...draft,
                file_id: nextFile.id,
                file_name: nextFile.name,
                sheet_name: nextSheet?.name ?? "",
                header_row: nextSheet?.detected_header_row ?? 1,
                first_data_row: (nextSheet?.detected_header_row ?? 1) + 1,
                selected_row_numbers: [],
                ignored_row_numbers: [],
              });
            }}
          />
          <SelectInput
            label="Sheet"
            help="Choose the worksheet tab that contains the rows you want to compare."
            value={draft.sheet_name}
            options={sheets.map((sheet) => ({ value: sheet.name, label: sheet.name }))}
            onChange={(value) => updateDraft({ ...draft, sheet_name: value, selected_row_numbers: [], ignored_row_numbers: [] })}
            error={!draft.sheet_name ? "Sheet is required." : undefined}
          />
        </EditorSection>

        <EditorSection title="Row boundaries" description="Set where headers live and where the real data starts.">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextInput
              label="Header row"
              help="The Excel row where column labels are located."
              type="number"
              value={String(draft.header_row)}
              onChange={(value) => updateDraft({ ...draft, header_row: Number(value) || 0, selected_row_numbers: [], ignored_row_numbers: [] })}
              error={draft.header_row < 1 ? "Header row must be 1 or greater." : undefined}
            />
            <TextInput
              label="First data row"
              help="The first row that contains real data. Rows above this are skipped."
              type="number"
              value={String(draft.first_data_row)}
              onChange={(value) => updateDraft({ ...draft, first_data_row: Number(value) || 0, selected_row_numbers: [], ignored_row_numbers: [] })}
              error={draft.first_data_row <= draft.header_row ? "First data row must be greater than the header row." : undefined}
            />
          </div>
        </EditorSection>
      </div>
    </BuilderDrawer>
  );
}

function FieldDrawer({
  editor,
  source,
  open,
  onClose,
  onSave,
  requestConfirm,
}: {
  editor: FieldEditorState | null;
  source: ComparisonDataSource | null;
  open: boolean;
  onClose: () => void;
  onSave: (field: ComparisonField) => void;
  requestConfirm: (state: ConfirmDialogState) => void;
}) {
  const { draft, setDraft, dirty, reset } = useDraftEditor(editor?.initial ?? null);

  if (!editor || !source || !draft) return null;
  const preview = editor.preview;
  const errors = validateField(draft, preview);
  const selectedColumn = preview?.columns.find((item) => item.letter === draft.column_letter);
  const footerMessage = errors[0] ?? (dirty ? "Save changes to update the field mapping used by rules and reports." : undefined);

  const handleCancel = () => {
    if (dirty) {
      requestConfirm({
        title: "Discard unsaved field changes?",
        description: "Your current field draft will be closed and the last saved mapping will remain unchanged.",
        confirmLabel: "Discard changes",
        tone: "danger",
        onConfirm: () => {
          reset();
          onClose();
        },
      });
      return;
    }
    reset();
    onClose();
  };

  const handleDiscard = () => {
    requestConfirm({
      title: "Discard field draft changes?",
      description: "This will throw away the current field edits and restore the last saved mapping.",
      confirmLabel: "Discard changes",
      tone: "danger",
      onConfirm: () => {
        reset();
        onClose();
      },
    });
  };

  return (
    <BuilderDrawer
      title={editor.mode === "create" ? "Create field" : "Edit field"}
      description="Map one spreadsheet column to a named value used in validation rules and reports."
      icon={SlidersHorizontal}
      open={open}
      dirty={dirty}
      onCancel={handleCancel}
      onDiscard={handleDiscard}
      onSave={() => onSave(draft)}
      saveLabel={editor.mode === "create" ? "Create field" : "Save changes"}
      disableSave={errors.length > 0}
      warningMessage={footerMessage}
    >
      <div className="space-y-5">
        <EditorSection title="Field details" description="Define the business label and comparison behavior for this value.">
          <TextInput
            label="Field name"
            help="The name used in rules and reports, such as Quantity, Unit Cost, or Brand."
            value={draft.field_name}
            onChange={(value) => setDraft({ ...draft, field_name: value, custom_display_name: value })}
            error={!draft.field_name.trim() ? "Field name is required." : undefined}
          />
          <SelectInput
            label="Field type"
            help="Controls how values are normalized and compared."
            value={draft.field_type}
            options={(Object.keys(fieldTypeLabels) as FieldType[]).map((value) => ({ value, label: fieldTypeLabels[value] }))}
            onChange={(value) => setDraft({ ...draft, field_type: value as FieldType })}
          />
          <CheckboxCard
            checked={draft.required}
            onChange={(checked) => setDraft({ ...draft, required: checked })}
            label="Required field"
            help="Flags selected rows where this field is blank."
          />
        </EditorSection>

        <EditorSection title="Column mapping" description="Choose the source column by letter so mapping stays stable even if headers are unclear or duplicated.">
          <div>
            <div className="mb-1.5">
              <FieldLabel help="The spreadsheet column where this value comes from. Column letters are used so mapping still works with unclear or duplicate headers.">
                Column
              </FieldLabel>
            </div>
            {preview ? (
              <ColumnPicker columns={preview.columns} value={draft.column_letter} onChange={(value) => {
                const column = preview.columns.find((item) => item.letter === value);
                setDraft({ ...draft, column_letter: value, original_header_label: column?.header_label ?? draft.original_header_label });
              }} />
            ) : (
              <p className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">Preview rows for this source before choosing a column.</p>
            )}
            {selectedColumn ? <p className="mt-2 text-sm text-slate-500">Selected column: <span className="font-semibold text-slate-900">{selectedColumn.letter}</span> / {selectedColumn.header_label || "Blank header"}</p> : null}
          </div>
        </EditorSection>

        <EditorSection title="Normalization" description="Choose how text values should be cleaned before comparison.">
          <div className="space-y-3">
            <CheckboxCard
              checked={draft.normalization.case_insensitive}
              onChange={(checked) => setDraft({ ...draft, normalization: { ...draft.normalization, case_insensitive: checked } })}
              label="Ignore case"
              help="Treat uppercase and lowercase text as equal during comparison."
            />
            <CheckboxCard
              checked={draft.normalization.trim_whitespace}
              onChange={(checked) => setDraft({ ...draft, normalization: { ...draft.normalization, trim_whitespace: checked } })}
              label="Trim spaces"
              help="Remove extra spaces at the start and end."
            />
            <CheckboxCard
              checked={draft.normalization.collapse_whitespace}
              onChange={(checked) => setDraft({ ...draft, normalization: { ...draft.normalization, collapse_whitespace: checked } })}
              label="Collapse spaces"
              help="Treat repeated spaces and line breaks as one space."
            />
          </div>
        </EditorSection>
      </div>
    </BuilderDrawer>
  );
}

function RuleDrawer({
  editor,
  sources,
  fieldsBySource,
  open,
  onClose,
  onSave,
  requestConfirm,
}: {
  editor: RuleEditorState | null;
  sources: ComparisonDataSource[];
  fieldsBySource: Record<string, ComparisonField[]>;
  open: boolean;
  onClose: () => void;
  onSave: (rule: ComparisonRule) => void;
  requestConfirm: (state: ConfirmDialogState) => void;
}) {
  const { draft, setDraft, dirty, reset } = useDraftEditor(editor?.initial ?? null);

  if (!editor || !draft) return null;

  const leftFields = draft.left_data_source_id ? fieldsBySource[draft.left_data_source_id] ?? [] : [];
  const rightFields = draft.right_data_source_id ? fieldsBySource[draft.right_data_source_id] ?? [] : [];
  const formulaFields = leftFields;
  const errors = validateRule(draft);
  const footerMessage = errors[0] ?? (dirty ? "Save changes to update the validation logic used during runs and PDF export." : undefined);

  const handleCancel = () => {
    if (dirty) {
      requestConfirm({
        title: "Discard unsaved rule changes?",
        description: "Your current rule draft will be closed and the last saved rule will remain unchanged.",
        confirmLabel: "Discard changes",
        tone: "danger",
        onConfirm: () => {
          reset();
          onClose();
        },
      });
      return;
    }
    reset();
    onClose();
  };

  const handleDiscard = () => {
    requestConfirm({
      title: "Discard rule draft changes?",
      description: "This will throw away the current rule edits and restore the last saved version.",
      confirmLabel: "Discard changes",
      tone: "danger",
      onConfirm: () => {
        reset();
        onClose();
      },
    });
  };

  const updateFormula = (value: FormulaSettings) => {
    setDraft({ ...draft, formula_settings: value, left_field_id: value.result_field_id });
  };

  return (
    <BuilderDrawer
      title={editor.mode === "create" ? "Create rule" : "Edit rule"}
      description="Choose what to validate, where the trusted value comes from, and how strictly values should match."
      icon={ListChecks}
      open={open}
      dirty={dirty}
      onCancel={handleCancel}
      onDiscard={handleDiscard}
      onSave={() => onSave(draft)}
      saveLabel={editor.mode === "create" ? "Create rule" : "Save changes"}
      disableSave={errors.length > 0}
      warningMessage={footerMessage}
    >
      <div className="space-y-5">
        <EditorSection title="Rule identity" description="Name the check and decide how prominently it should surface in results.">
          <TextInput
            label="Rule name"
            help="A readable name for this check in the results and PDF report."
            value={draft.rule_name}
            onChange={(value) => setDraft({ ...draft, rule_name: value })}
            error={!draft.rule_name.trim() ? "Rule name is required." : undefined}
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SelectInput
              label="Severity"
              help="Controls how important this issue appears in results."
              value={draft.severity}
              options={(Object.keys(severityLabels) as Severity[]).map((value) => ({ value, label: severityLabels[value] }))}
              onChange={(value) => setDraft({ ...draft, severity: value as Severity })}
            />
            <CheckboxCard
              checked={draft.enabled}
              onChange={(checked) => setDraft({ ...draft, enabled: checked })}
              label="Enabled"
              help="Disabled rules are saved but skipped during validation."
            />
          </div>
        </EditorSection>

        <EditorSection title="What to check" description="Choose the kind of validation the rule should perform.">
          <SelectInput
            label="Rule type"
            help="Choose the kind of validation to perform."
            value={draft.rule_type}
            options={(Object.keys(ruleTypeLabels) as RuleType[]).map((value) => ({ value, label: ruleTypeLabels[value] }))}
            onChange={(value) => setDraft({ ...draft, rule_type: value as RuleType })}
          />
        </EditorSection>

        <EditorSection title="Expected value" description="Choose the trusted source field or formula base.">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SelectInput
              label="Source"
              help="The trusted value or formula source."
              value={draft.left_data_source_id ?? ""}
              options={sources.map((source) => ({ value: source.id, label: source.name }))}
              onChange={(value) => {
                const sourceFields = fieldsBySource[value] ?? [];
                const firstField = sourceFields[0];
                const secondField = sourceFields[1] ?? firstField;
                setDraft({
                  ...draft,
                  left_data_source_id: value,
                  left_field_id: firstField?.id ?? null,
                  left_match_field_ids: firstField?.id ? [firstField.id] : [],
                  formula_settings: draft.rule_type === "formula_check"
                    ? {
                        operator: draft.formula_settings?.operator ?? "multiply",
                        operand_field_ids: [firstField?.id ?? "", secondField?.id ?? ""],
                        result_field_id: firstField?.id ?? "",
                      }
                    : draft.formula_settings,
                });
              }}
            />
            <SelectInput
              label="Field"
              help="The trusted value or formula source."
              value={draft.left_field_id ?? ""}
              options={leftFields.map((field) => ({ value: field.id, label: fieldLabel(field) }))}
              onChange={(value) => setDraft({ ...draft, left_field_id: value, left_match_field_ids: [value] })}
            />
          </div>
        </EditorSection>

        {draft.rule_type === "compare_values" ? (
          <EditorSection title="Actual value" description="Choose the field that should match the expected value.">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SelectInput
                label="Source"
                help="The value being checked against the expected value."
                value={draft.right_data_source_id ?? ""}
                options={sources.map((source) => ({ value: source.id, label: source.name }))}
                onChange={(value) => {
                  const sourceFields = fieldsBySource[value] ?? [];
                  const firstField = sourceFields[0];
                  setDraft({
                    ...draft,
                    right_data_source_id: value,
                    right_field_id: firstField?.id ?? null,
                    right_match_field_ids: firstField?.id ? [firstField.id] : [],
                  });
                }}
              />
              <SelectInput
                label="Field"
                help="The value being checked against the expected value."
                value={draft.right_field_id ?? ""}
                options={rightFields.map((field) => ({ value: field.id, label: fieldLabel(field) }))}
                onChange={(value) => setDraft({ ...draft, right_field_id: value, right_match_field_ids: [value] })}
              />
            </div>
          </EditorSection>
        ) : null}

        {draft.rule_type === "formula_check" ? (
          <EditorSection title="Formula setup" description="Choose the two input fields, operator, and result field for the formula check.">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SelectInput
                label="First value"
                help="The trusted value or formula source."
                value={draft.formula_settings?.operand_field_ids[0] ?? ""}
                options={formulaFields.map((field) => ({ value: field.id, label: fieldLabel(field) }))}
                onChange={(value) => updateFormula({
                  operator: draft.formula_settings?.operator ?? "multiply",
                  operand_field_ids: [value, draft.formula_settings?.operand_field_ids[1] ?? value],
                  result_field_id: draft.formula_settings?.result_field_id ?? value,
                })}
              />
              <SelectInput
                label="Operator"
                help="Choose the formula operator used to derive the expected result."
                value={draft.formula_settings?.operator ?? "multiply"}
                options={(Object.keys(formulaOperatorLabels) as FormulaSettings["operator"][]).map((value) => ({ value, label: formulaOperatorLabels[value] }))}
                onChange={(value) => updateFormula({
                  operator: value as FormulaSettings["operator"],
                  operand_field_ids: draft.formula_settings?.operand_field_ids ?? ["", ""],
                  result_field_id: draft.formula_settings?.result_field_id ?? "",
                })}
              />
              <SelectInput
                label="Second value"
                help="The trusted value or formula source."
                value={draft.formula_settings?.operand_field_ids[1] ?? ""}
                options={formulaFields.map((field) => ({ value: field.id, label: fieldLabel(field) }))}
                onChange={(value) => updateFormula({
                  operator: draft.formula_settings?.operator ?? "multiply",
                  operand_field_ids: [draft.formula_settings?.operand_field_ids[0] ?? value, value],
                  result_field_id: draft.formula_settings?.result_field_id ?? value,
                })}
              />
              <SelectInput
                label="Actual result field"
                help="The value being checked against the expected value."
                value={draft.formula_settings?.result_field_id ?? ""}
                options={formulaFields.map((field) => ({ value: field.id, label: fieldLabel(field) }))}
                onChange={(value) => updateFormula({
                  operator: draft.formula_settings?.operator ?? "multiply",
                  operand_field_ids: draft.formula_settings?.operand_field_ids ?? [value, value],
                  result_field_id: value,
                })}
              />
            </div>
          </EditorSection>
        ) : null}

        <EditorSection title="Matching and strictness" description="Control how rows are paired and how exact values must be before the rule reports an issue.">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SelectInput
              label="Match rows by"
              help="Controls how rows from different sources are paired before comparison."
              value={draft.match_strategy}
              options={(Object.keys(matchLabels) as MatchStrategy[]).map((value) => ({ value, label: matchLabels[value] }))}
              onChange={(value) => setDraft({ ...draft, match_strategy: value as MatchStrategy })}
            />
            <SelectInput
              label="Comparison strictness"
              help="Controls how exact the values must be."
              value={draft.strictness}
              options={(Object.keys(strictnessLabels) as RuleStrictness[]).map((value) => ({ value, label: strictnessLabels[value] }))}
              onChange={(value) => setDraft({ ...draft, strictness: value as RuleStrictness })}
            />
          </div>
          {draft.strictness === "numeric_tolerance" || draft.strictness === "currency_tolerance" ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {draft.strictness === "numeric_tolerance" ? (
                <TextInput label="Numeric tolerance" help="Allowed numeric difference before this rule reports a mismatch." value={draft.numeric_tolerance ?? ""} onChange={(value) => setDraft({ ...draft, numeric_tolerance: value || null })} />
              ) : null}
              {draft.strictness === "currency_tolerance" ? (
                <TextInput label="Currency tolerance" help="Allowed currency difference before this rule reports a mismatch." value={draft.currency_tolerance ?? ""} onChange={(value) => setDraft({ ...draft, currency_tolerance: value || null })} />
              ) : null}
            </div>
          ) : null}
        </EditorSection>
      </div>
    </BuilderDrawer>
  );
}

function EditorSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function TextInput({
  label,
  help,
  value,
  onChange,
  type = "text",
  error,
}: {
  label: string;
  help: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  error?: string;
}) {
  return (
    <div>
      <div className="mb-1.5">
        <FieldLabel help={help}>{label}</FieldLabel>
      </div>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full rounded-2xl border px-3 py-2.5 text-sm outline-none transition focus:border-emerald-600 focus:ring-3 focus:ring-emerald-100 ${error ? "border-red-300 bg-red-50" : "border-slate-300 bg-white"}`}
      />
      <p className={`mt-2 text-sm ${error ? "text-red-700" : "text-slate-500"}`}>{error ?? help}</p>
    </div>
  );
}

function SelectInput({
  label,
  help,
  value,
  options,
  onChange,
  error,
}: {
  label: string;
  help: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <div>
      <div className="mb-1.5">
        <FieldLabel help={help}>{label}</FieldLabel>
      </div>
      <SelectField
        value={value}
        onChange={onChange}
        ariaLabel={label}
        helpText={help}
        options={[{ value: "", label: "Select an option", description: help }, ...options]}
        className={`${error ? "[&_button]:border-red-300 [&_button]:bg-red-50 [&_button]:text-slate-900" : ""}`}
      />
      <p className={`mt-2 text-sm ${error ? "text-red-700" : "text-slate-500"}`}>{error ?? help}</p>
    </div>
  );
}

function CheckboxCard({
  checked,
  onChange,
  label,
  help,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  help: string;
}) {
  return (
    <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 size-4 rounded border-slate-300 accent-emerald-700" />
      <span className="space-y-1">
        <span className="flex items-center gap-1 font-semibold text-slate-900">
          {label}
          <HelpTip text={help} />
        </span>
        <span className="block text-sm text-slate-500">{help}</span>
      </span>
    </label>
  );
}

function ConfirmationDialog({ state, onClose }: { state: ConfirmDialogState | null; onClose: () => void }) {
  if (!state) return null;

  const confirmClass =
    state.tone === "danger"
      ? "rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
      : "rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600";

  const dialog = (
    <div className="fixed inset-0 z-[130] flex items-center justify-center px-4">
      <button aria-label="Close confirmation dialog" className="absolute inset-0 bg-slate-950/35 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="builder-confirm-title"
        className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl animate-[builder-dialog-in_180ms_cubic-bezier(0.16,1,0.3,1)_forwards]"
      >
        <h2 id="builder-confirm-title" className="text-lg font-semibold text-slate-950">
          {state.title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{state.description}</p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              state.onConfirm();
              onClose();
            }}
            className={confirmClass}
          >
            {state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
