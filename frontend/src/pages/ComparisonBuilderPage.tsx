import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Columns3,
  Database,
  Edit3,
  FileSpreadsheet,
  ListChecks,
  LoaderCircle,
  Plus,
  Play,
  Rows3,
  Settings2,
  SlidersHorizontal,
  Trash2,
  Wand2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "../components/common/EmptyState";
import { StatusBadge } from "../components/common/StatusBadge";
import { PageHeader } from "../components/layout/PageHeader";
import { BuilderDrawer } from "../components/validation/BuilderDrawer";
import { BuilderStepper, type BuilderStep } from "../components/validation/BuilderStepper";
import { ColumnPicker } from "../components/validation/ColumnPicker";
import { RowSelectionTable } from "../components/validation/RowSelectionTable";
import { useWorkflow } from "../features/files/WorkflowContext";
import { previewDataSource } from "../services/fileApi";
import { runValidation } from "../services/validationApi";
import type { UploadedFile } from "../types/file.types";
import type {
  ComparisonDataSource,
  ComparisonField,
  ComparisonRule,
  DataSourcePreview,
  FieldType,
  MatchStrategy,
  PresetType,
  RuleStrictness,
  RuleType,
  Severity,
} from "../types/validation.types";

type BuilderStepId = "sources" | "rows" | "fields" | "rules" | "review";

const commonFields = [
  { field_name: "Item Number", match: ["item", "no"] },
  { field_name: "Description", match: ["description", "particular", "specification"] },
  { field_name: "Quantity", match: ["qty", "quantity"] },
  { field_name: "Unit", match: ["unit", "uom"] },
  { field_name: "Unit Cost", match: ["unit cost", "unit price", "price"] },
  { field_name: "Total Cost", match: ["total", "amount"] },
];

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
  normalized_exact: "Normalized exact",
  numeric_tolerance: "Numeric tolerance",
  currency_tolerance: "Currency tolerance",
};

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
  const text = fieldName.toLowerCase();
  if (text.includes("cost") || text.includes("amount") || text.includes("price")) return "currency";
  if (text.includes("qty") || text.includes("quantity")) return "number";
  return "text";
}

function inferField(preview: DataSourcePreview, fieldName: string, terms: string[], dataSourceId: string): ComparisonField | null {
  const column = preview.columns.find((item) => terms.some((term) => item.header_label.toLowerCase().includes(term)));
  if (!column) return null;
  return {
    id: makeId("field"),
    data_source_id: dataSourceId,
    field_name: fieldName,
    field_type: fieldTypeForName(fieldName),
    column_letter: column.letter,
    original_header_label: column.header_label,
    custom_display_name: fieldName,
    required: ["Description", "Quantity"].includes(fieldName),
    normalization: { case_insensitive: true, trim_whitespace: true, collapse_whitespace: true },
  };
}

function fieldLabel(field?: ComparisonField | null) {
  return field?.custom_display_name || field?.field_name || "Not selected";
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

function makeCompareRule(left: ComparisonDataSource, right: ComparisonDataSource, fieldName: string): ComparisonRule | null {
  const leftField = left.fields.find((field) => field.field_name.toLowerCase() === fieldName.toLowerCase());
  const rightField = right.fields.find((field) => field.field_name.toLowerCase() === fieldName.toLowerCase());
  if (!leftField || !rightField) return null;
  const leftKey = left.fields.find((field) => field.field_name.toLowerCase() === "item number") ?? leftField;
  const rightKey = right.fields.find((field) => field.field_name.toLowerCase() === "item number") ?? rightField;
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
    strictness: leftField.field_type === "number" ? "exact" : leftField.field_type === "currency" ? "currency_tolerance" : "normalized_exact",
    numeric_tolerance: null,
    currency_tolerance: leftField.field_type === "currency" ? "0.01" : null,
    formula_settings: null,
    severity: fieldName === "Description" ? "high" : "medium",
    enabled: true,
  };
}

function ruleIsRunnable(rule: ComparisonRule) {
  if (!rule.enabled) return true;
  if (rule.rule_type === "compare_values") return Boolean(rule.left_data_source_id && rule.left_field_id && rule.right_data_source_id && rule.right_field_id);
  if (rule.rule_type === "formula_check") return Boolean(rule.left_data_source_id && rule.formula_settings?.operand_field_ids.length === 2 && rule.formula_settings.result_field_id);
  return Boolean(rule.left_data_source_id && rule.left_field_id);
}

export function ComparisonBuilderPage() {
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
    rules,
    setRules,
    updateRule,
    removeRule,
    setResult,
  } = useWorkflow();
  const [activeStep, setActiveStep] = useState<BuilderStepId>("sources");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [presetDecision, setPresetDecision] = useState<"pending" | "applied" | "manual">("pending");
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<{ sourceId: string; fieldId: string } | null>(null);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  useEffect(() => {
    if (!files.length || dataSources.length) return;
    setDataSources(scaffoldSources(files));
  }, [files, dataSources.length, setDataSources]);

  const selectedSource = dataSources.find((source) => source.id === editingSourceId) ?? null;
  const editingFieldSource = editingField ? dataSources.find((source) => source.id === editingField.sourceId) ?? null : null;
  const selectedField = editingFieldSource?.fields.find((field) => field.id === editingField?.fieldId) ?? null;
  const selectedRule = rules.find((rule) => rule.id === editingRuleId) ?? null;
  const fieldsBySource = useMemo(() => Object.fromEntries(dataSources.map((source) => [source.id, source.fields])), [dataSources]);

  const warnings = useMemo(() => {
    const items: string[] = [];
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
  }, [dataSources, rules, sourcePreviews]);

  const enabledRules = rules.filter((rule) => rule.enabled);
  const canRun = dataSources.length > 0 && enabledRules.length > 0 && warnings.every((warning) => !warning.includes("zero selected rows") && !warning.includes("no fields") && !warning.includes("No enabled") && !warning.includes("incomplete"));

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

  const addDataSource = () => {
    const file = files[0];
    if (!file) return;
    const source = createDataSource(file, dataSources.length);
    setDataSources([...dataSources, source]);
    setEditingSourceId(source.id);
  };

  const applyPresetSetup = () => {
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

  const applyCommonFields = (source: ComparisonDataSource) => {
    const preview = sourcePreviews[source.id];
    if (!preview) return;
    const nextFields = commonFields.map((field) => inferField(preview, field.field_name, field.match, source.id)).filter((field): field is ComparisonField => Boolean(field));
    updateDataSource(source.id, { ...source, fields: nextFields });
  };

  const addField = (source: ComparisonDataSource) => {
    const preview = sourcePreviews[source.id];
    const column = preview?.columns.find((item) => !source.fields.some((field) => field.column_letter === item.letter)) ?? preview?.columns[0];
    if (!column) return;
    const field: ComparisonField = {
      id: makeId("field"),
      data_source_id: source.id,
      field_name: `Field ${source.fields.length + 1}`,
      field_type: "text",
      column_letter: column.letter,
      original_header_label: column.header_label,
      custom_display_name: null,
      required: false,
      normalization: { case_insensitive: true, trim_whitespace: true, collapse_whitespace: true },
    };
    updateDataSource(source.id, { ...source, fields: [...source.fields, field] });
    setEditingField({ sourceId: source.id, fieldId: field.id });
  };

  const buildSuggestedRules = () => {
    if (dataSources.length < 2) return;
    const left = dataSources[0];
    const right = dataSources[dataSources.length - 1];
    if (!left || !right) return;
    const next = ["Description", "Quantity", "Unit Cost", "Total Cost"].map((fieldName) => makeCompareRule(left, right, fieldName)).filter((rule): rule is ComparisonRule => Boolean(rule));
    setRules(next);
  };

  const addRule = () => {
    const leftSource = dataSources[0];
    const rightSource = dataSources[1] ?? dataSources[0];
    const leftField = leftSource?.fields[0];
    const rightField = rightSource?.fields[0];
    if (!leftSource || !leftField) return;
    const rule: ComparisonRule = {
      id: makeId("rule"),
      rule_name: `Rule ${rules.length + 1}`,
      rule_type: "compare_values",
      left_data_source_id: leftSource.id,
      left_field_id: leftField.id,
      right_data_source_id: rightSource?.id ?? null,
      right_field_id: rightField?.id ?? null,
      left_match_field_ids: leftField ? [leftField.id] : [],
      right_match_field_ids: rightField ? [rightField.id] : [],
      match_strategy: "by_row_order",
      strictness: "normalized_exact",
      numeric_tolerance: null,
      currency_tolerance: null,
      formula_settings: null,
      severity: "medium",
      enabled: true,
    };
    setRules([...rules, rule]);
    setEditingRuleId(rule.id);
  };

  const run = async () => {
    setBusy("validation");
    setError("");
    try {
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
        action={<button onClick={addDataSource} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white"><Plus className="size-4" /> Add source</button>}
      />

      <div className="space-y-6 pt-6">
        <BuilderStepper steps={steps} activeStep={activeStep} onStepChange={(step) => setActiveStep(step as BuilderStepId)} />
        {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        {presetDecision === "pending" && preset !== "custom_comparison_builder" ? (
          <section className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-emerald-950">Preset setup available</p>
                <p className="mt-1 text-sm text-emerald-800">This preset can suggest source labels and starter checks. Uploaded files keep neutral names until you apply it.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={applyPresetSetup} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"><Wand2 className="size-4" /> Apply preset setup</button>
                <button onClick={() => setPresetDecision("manual")} className="rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-800">Start manually</button>
              </div>
            </div>
          </section>
        ) : null}

        {activeStep === "sources" ? (
          <section className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              {dataSources.map((source) => {
                const preview = sourcePreviews[source.id];
                return (
                  <article key={source.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h2 className="truncate text-base font-semibold text-slate-950">{source.name}</h2>
                        <p className="mt-1 truncate text-sm text-slate-500">{source.file_name ?? "No file"} / {source.sheet_name || "No sheet"}</p>
                      </div>
                      <div className="flex gap-1">
                        <button title="Edit source" onClick={() => setEditingSourceId(source.id)} className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><Edit3 className="size-4" /></button>
                        <button title="Delete source" onClick={() => removeDataSource(source.id)} className="grid size-9 place-items-center rounded-lg text-red-700 hover:bg-red-50"><Trash2 className="size-4" /></button>
                      </div>
                    </div>
                    <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                      <div><dt className="text-xs text-slate-500">Header row</dt><dd className="mt-1 font-semibold">{source.header_row}</dd></div>
                      <div><dt className="text-xs text-slate-500">First data row</dt><dd className="mt-1 font-semibold">{source.first_data_row}</dd></div>
                      <div><dt className="text-xs text-slate-500">Selected rows</dt><dd className="mt-1 font-semibold">{source.selected_row_numbers.length}</dd></div>
                      <div><dt className="text-xs text-slate-500">Fields</dt><dd className="mt-1 font-semibold">{source.fields.length}</dd></div>
                    </dl>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <button onClick={() => refreshPreview(source)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                        {busy === source.id ? <LoaderCircle className="size-4 animate-spin" /> : <Rows3 className="size-4" />}
                        {preview ? "Refresh preview" : "Preview rows"}
                      </button>
                      {preview ? <StatusBadge tone="success">Preview ready</StatusBadge> : <StatusBadge tone="warning">Needs preview</StatusBadge>}
                    </div>
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
                  <article key={source.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div><h2 className="font-semibold">{source.name}</h2><p className="mt-1 text-sm text-slate-500">Preview rows before selecting data rows.</p></div>
                      <button onClick={() => refreshPreview(source)} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Preview rows</button>
                    </div>
                  </article>
                );
              }
              const headers = preview.columns.map((column) => column.header_label);
              return (
                <article key={source.id} className="space-y-3">
                  <div className="flex items-end justify-between gap-4">
                    <div><h2 className="font-semibold">{source.name}</h2><p className="mt-1 text-sm text-slate-500">{source.selected_row_numbers.length} selected / {source.ignored_row_numbers.length} ignored</p></div>
                  </div>
                  <RowSelectionTable
                    headers={headers}
                    rows={preview.rows}
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
                <article key={source.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div><h2 className="font-semibold">{source.name}</h2><p className="mt-1 text-sm text-slate-500">{source.fields.length} mapped field(s)</p></div>
                    <div className="flex gap-2">
                      <button disabled={!preview} onClick={() => applyCommonFields(source)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">Apply common procurement fields</button>
                      <button disabled={!preview} onClick={() => addField(source)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Plus className="size-4" /> Add field</button>
                    </div>
                  </div>
                  {!preview ? <p className="mt-4 text-sm text-slate-500">Preview this source before adding fields.</p> : null}
                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {source.fields.map((field) => (
                      <div key={field.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{fieldLabel(field)}</p>
                            <p className="mt-1 text-xs text-slate-500">{field.field_type} / column {field.column_letter}</p>
                          </div>
                          <div className="flex gap-1">
                            <button title="Edit field" onClick={() => setEditingField({ sourceId: source.id, fieldId: field.id })} className="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-white"><Edit3 className="size-4" /></button>
                            <button title="Remove field" onClick={() => updateDataSource(source.id, { ...source, fields: source.fields.filter((item) => item.id !== field.id) })} className="grid size-8 place-items-center rounded-lg text-red-700 hover:bg-red-50"><Trash2 className="size-4" /></button>
                          </div>
                        </div>
                        <p className="mt-3 truncate text-xs text-slate-500">{field.original_header_label || "Blank header"}</p>
                        <div className="mt-3">{field.required ? <StatusBadge tone="warning">Required</StatusBadge> : <StatusBadge>Optional</StatusBadge>}</div>
                      </div>
                    ))}
                  </div>
                </article>
              );
            })}
          </section>
        ) : null}

        {activeStep === "rules" ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="font-semibold">Rules</h2><p className="mt-1 text-sm text-slate-500">{enabledRules.length} enabled rule(s)</p></div>
              <div className="flex gap-2">
                <button onClick={buildSuggestedRules} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Build suggested rules</button>
                <button onClick={addRule} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"><Plus className="size-4" /> Add rule</button>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {rules.map((rule) => {
                const left = dataSources.find((source) => source.id === rule.left_data_source_id);
                const right = dataSources.find((source) => source.id === rule.right_data_source_id);
                const leftField = left?.fields.find((field) => field.id === rule.left_field_id);
                const rightField = right?.fields.find((field) => field.id === rule.right_field_id);
                return (
                  <article key={rule.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-sm font-semibold">{rule.rule_name || ruleLabel(rule, dataSources)}</h3>
                          <StatusBadge tone={rule.enabled ? "success" : "neutral"}>{rule.enabled ? "Enabled" : "Disabled"}</StatusBadge>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">{ruleTypeLabels[rule.rule_type]} / {matchLabels[rule.match_strategy]} / {strictnessLabels[rule.strictness]}</p>
                        <p className="mt-1 truncate text-xs text-slate-500">{left?.name ?? "Source"}: {fieldLabel(leftField)} {right ? `/ ${right.name}: ${fieldLabel(rightField)}` : ""}</p>
                      </div>
                      <div className="flex gap-1">
                        <button title="Edit rule" onClick={() => setEditingRuleId(rule.id)} className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-white"><Edit3 className="size-4" /></button>
                        <button title="Remove rule" onClick={() => removeRule(rule.id)} className="grid size-9 place-items-center rounded-lg text-red-700 hover:bg-red-50"><Trash2 className="size-4" /></button>
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
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold">Review setup</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Summary label="Files uploaded" value={files.length} />
                <Summary label="Data sources" value={dataSources.length} />
                <Summary label="Selected rows" value={dataSources.reduce((total, source) => total + source.selected_row_numbers.length, 0)} />
                <Summary label="Enabled rules" value={enabledRules.length} />
              </div>
              <div className="mt-6 space-y-3">
                {dataSources.map((source) => (
                  <div key={source.id} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <FileSpreadsheet className="size-5 text-emerald-700" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{source.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{source.selected_row_numbers.length} rows / {source.fields.length} fields / {source.sheet_name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <aside className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-600" />
                <h2 className="font-semibold">Warnings</h2>
              </div>
              <div className="mt-4 space-y-2">
                {warnings.length ? warnings.map((warning) => <p key={warning} className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{warning}</p>) : <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Setup is ready to validate.</p>}
              </div>
              <button disabled={!canRun || busy === "validation"} onClick={run} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
                {busy === "validation" ? <LoaderCircle className="size-4 animate-spin" /> : <Play className="size-4" />}
                {busy === "validation" ? "Running validation..." : "Run validation"}
              </button>
            </aside>
          </section>
        ) : null}
      </div>

      <SourceDrawer files={files} source={selectedSource} open={Boolean(selectedSource)} onClose={() => setEditingSourceId(null)} onChange={(source) => updateDataSource(source.id, source)} onPreview={refreshPreview} busy={busy} />
      <FieldDrawer source={editingFieldSource} field={selectedField} preview={editingFieldSource ? sourcePreviews[editingFieldSource.id] : undefined} open={Boolean(selectedField && editingFieldSource)} onClose={() => setEditingField(null)} onChange={(source) => updateDataSource(source.id, source)} />
      <RuleDrawer rule={selectedRule} sources={dataSources} fieldsBySource={fieldsBySource} open={Boolean(selectedRule)} onClose={() => setEditingRuleId(null)} onChange={(rule) => updateRule(rule.id, rule)} />
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function SourceDrawer({ files, source, open, onClose, onChange, onPreview, busy }: { files: UploadedFile[]; source: ComparisonDataSource | null; open: boolean; onClose: () => void; onChange: (source: ComparisonDataSource) => void; onPreview: (source: ComparisonDataSource) => void; busy: string | null }) {
  if (!source) return null;
  const file = files.find((item) => item.id === source.file_id) ?? files[0];
  const sheets = file?.sheets ?? [];
  return (
    <BuilderDrawer title="Edit source" description="Choose the file section and basic row boundaries for this source." open={open} onClose={onClose} footer={<button onClick={() => onPreview(source)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">{busy === source.id ? <LoaderCircle className="size-4 animate-spin" /> : <Rows3 className="size-4" />} Preview rows</button>}>
      <div className="space-y-4">
        <Input label="Source name" value={source.name} onChange={(value) => onChange({ ...source, name: value })} />
        <Select label="File" value={source.file_id} options={files.map((item) => ({ value: item.id, label: item.name }))} onChange={(value) => {
          const nextFile = files.find((item) => item.id === value) ?? files[0];
          if (!nextFile) return;
          const nextSheet = nextFile.sheets[0];
          onChange({ ...source, file_id: nextFile.id, file_name: nextFile.name, sheet_name: nextSheet?.name ?? "", header_row: nextSheet?.detected_header_row ?? 1, first_data_row: (nextSheet?.detected_header_row ?? 1) + 1, selected_row_numbers: [], ignored_row_numbers: [] });
        }} />
        <Select label="Sheet" value={source.sheet_name} options={sheets.map((sheet) => ({ value: sheet.name, label: sheet.name }))} onChange={(value) => onChange({ ...source, sheet_name: value, selected_row_numbers: [], ignored_row_numbers: [] })} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Header row" type="number" value={String(source.header_row)} onChange={(value) => onChange({ ...source, header_row: Number(value) })} />
          <Input label="First data row" type="number" value={String(source.first_data_row)} onChange={(value) => onChange({ ...source, first_data_row: Number(value) })} />
        </div>
      </div>
    </BuilderDrawer>
  );
}

function FieldDrawer({ source, field, preview, open, onClose, onChange }: { source: ComparisonDataSource | null; field: ComparisonField | null; preview?: DataSourcePreview; open: boolean; onClose: () => void; onChange: (source: ComparisonDataSource) => void }) {
  if (!source || !field) return null;
  const updateField = (next: ComparisonField) => onChange({ ...source, fields: source.fields.map((item) => item.id === field.id ? next : item) });
  return (
    <BuilderDrawer title="Edit field" description="Map one spreadsheet column to a named value used by rules." open={open} onClose={onClose}>
      <div className="space-y-4">
        <Input label="Field name" value={field.field_name} onChange={(value) => updateField({ ...field, field_name: value, custom_display_name: value })} />
        <Select label="Field type" value={field.field_type} options={["text", "number", "currency", "date", "boolean", "raw"].map((value) => ({ value, label: value }))} onChange={(value) => updateField({ ...field, field_type: value as FieldType })} />
        {preview ? <div><Label>Column</Label><ColumnPicker columns={preview.columns} value={field.column_letter} onChange={(value) => {
          const column = preview.columns.find((item) => item.letter === value);
          updateField({ ...field, column_letter: value, original_header_label: column?.header_label ?? field.original_header_label });
        }} /></div> : null}
        <label className="flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-700">
          <input type="checkbox" checked={field.required} onChange={(event) => updateField({ ...field, required: event.target.checked })} />
          Required field
        </label>
        <label className="flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-700">
          <input type="checkbox" checked={field.normalization.case_insensitive} onChange={(event) => updateField({ ...field, normalization: { ...field.normalization, case_insensitive: event.target.checked } })} />
          Ignore case when comparing text
        </label>
      </div>
    </BuilderDrawer>
  );
}

function RuleDrawer({ rule, sources, fieldsBySource, open, onClose, onChange }: { rule: ComparisonRule | null; sources: ComparisonDataSource[]; fieldsBySource: Record<string, ComparisonField[]>; open: boolean; onClose: () => void; onChange: (rule: ComparisonRule) => void }) {
  if (!rule) return null;
  const leftFields = rule.left_data_source_id ? fieldsBySource[rule.left_data_source_id] ?? [] : [];
  const rightFields = rule.right_data_source_id ? fieldsBySource[rule.right_data_source_id] ?? [] : [];
  const formulaFields = leftFields;
  return (
    <BuilderDrawer title="Edit rule" description="Choose what to check and how rows should match." open={open} onClose={onClose}>
      <div className="space-y-5">
        <Input label="Rule name" value={rule.rule_name} onChange={(value) => onChange({ ...rule, rule_name: value })} />
        <Select label="What do you want to check?" value={rule.rule_type} options={(Object.keys(ruleTypeLabels) as RuleType[]).map((value) => ({ value, label: ruleTypeLabels[value] }))} onChange={(value) => onChange({ ...rule, rule_type: value as RuleType })} />
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-3 text-sm font-semibold">Expected value</p>
          <div className="space-y-3">
            <Select label="Source" value={rule.left_data_source_id ?? ""} options={sources.map((source) => ({ value: source.id, label: source.name }))} onChange={(value) => onChange({ ...rule, left_data_source_id: value, left_field_id: (fieldsBySource[value] ?? [])[0]?.id ?? null })} />
            <Select label="Field" value={rule.left_field_id ?? ""} options={leftFields.map((field) => ({ value: field.id, label: fieldLabel(field) }))} onChange={(value) => onChange({ ...rule, left_field_id: value, left_match_field_ids: [value] })} />
          </div>
        </div>
        {rule.rule_type === "compare_values" ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="mb-3 text-sm font-semibold">Actual value</p>
            <div className="space-y-3">
              <Select label="Source" value={rule.right_data_source_id ?? ""} options={sources.map((source) => ({ value: source.id, label: source.name }))} onChange={(value) => onChange({ ...rule, right_data_source_id: value, right_field_id: (fieldsBySource[value] ?? [])[0]?.id ?? null })} />
              <Select label="Field" value={rule.right_field_id ?? ""} options={rightFields.map((field) => ({ value: field.id, label: fieldLabel(field) }))} onChange={(value) => onChange({ ...rule, right_field_id: value, right_match_field_ids: [value] })} />
            </div>
          </div>
        ) : null}
        {rule.rule_type === "formula_check" ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="mb-3 text-sm font-semibold">Formula</p>
            <div className="space-y-3">
              <Select label="First value" value={rule.formula_settings?.operand_field_ids[0] ?? ""} options={formulaFields.map((field) => ({ value: field.id, label: fieldLabel(field) }))} onChange={(value) => onChange({ ...rule, formula_settings: { operator: rule.formula_settings?.operator ?? "multiply", operand_field_ids: [value, rule.formula_settings?.operand_field_ids[1] ?? value], result_field_id: rule.formula_settings?.result_field_id ?? value } })} />
              <Select label="Second value" value={rule.formula_settings?.operand_field_ids[1] ?? ""} options={formulaFields.map((field) => ({ value: field.id, label: fieldLabel(field) }))} onChange={(value) => onChange({ ...rule, formula_settings: { operator: rule.formula_settings?.operator ?? "multiply", operand_field_ids: [rule.formula_settings?.operand_field_ids[0] ?? value, value], result_field_id: rule.formula_settings?.result_field_id ?? value } })} />
              <Select label="Actual result field" value={rule.formula_settings?.result_field_id ?? ""} options={formulaFields.map((field) => ({ value: field.id, label: fieldLabel(field) }))} onChange={(value) => onChange({ ...rule, formula_settings: { operator: rule.formula_settings?.operator ?? "multiply", operand_field_ids: rule.formula_settings?.operand_field_ids ?? [value, value], result_field_id: value }, left_field_id: value })} />
            </div>
          </div>
        ) : null}
        <Select label="Match rows by" value={rule.match_strategy} options={(Object.keys(matchLabels) as MatchStrategy[]).map((value) => ({ value, label: matchLabels[value] }))} onChange={(value) => onChange({ ...rule, match_strategy: value as MatchStrategy })} />
        <Select label="Comparison strictness" value={rule.strictness} options={(Object.keys(strictnessLabels) as RuleStrictness[]).map((value) => ({ value, label: strictnessLabels[value] }))} onChange={(value) => onChange({ ...rule, strictness: value as RuleStrictness })} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Numeric tolerance" value={rule.numeric_tolerance ?? ""} onChange={(value) => onChange({ ...rule, numeric_tolerance: value || null })} />
          <Input label="Currency tolerance" value={rule.currency_tolerance ?? ""} onChange={(value) => onChange({ ...rule, currency_tolerance: value || null })} />
        </div>
        <Select label="Severity" value={rule.severity} options={(["low", "medium", "high"] as Severity[]).map((value) => ({ value, label: value }))} onChange={(value) => onChange({ ...rule, severity: value as Severity })} />
        <label className="flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-700">
          <input type="checkbox" checked={rule.enabled} onChange={(event) => onChange({ ...rule, enabled: event.target.checked })} />
          Enabled
        </label>
      </div>
    </BuilderDrawer>
  );
}

function Label({ children }: { children: string }) {
  return <label className="mb-1.5 block text-xs font-semibold text-slate-700">{children}</label>;
}

function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-600 focus:ring-3 focus:ring-emerald-100" />
    </div>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-600 focus:ring-3 focus:ring-emerald-100">
        {options.length ? options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>) : <option value="">No options available</option>}
      </select>
    </div>
  );
}
