import { ArrowRight, Database, Eye, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "../components/common/EmptyState";
import { PageHeader } from "../components/layout/PageHeader";
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
  PresetType,
  RuleType,
} from "../types/validation.types";

const procurementFieldPresets = [
  { field_name: "Item Number", match: ["item", "no"] },
  { field_name: "Description", match: ["description", "particular", "specification"] },
  { field_name: "Quantity", match: ["qty", "quantity"] },
  { field_name: "Unit", match: ["unit", "uom"] },
  { field_name: "Unit Cost", match: ["unit cost", "unit price", "price"] },
  { field_name: "Total Cost", match: ["total", "amount"] },
];

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function presetLabel(preset: PresetType, index: number) {
  if (preset === "reference_bidder_abstract") return ["Reference source", "Bidder source", "Abstract source"][index] ?? `Data source ${index + 1}`;
  if (preset === "reference_vs_copied") return ["Reference source", "Copied source"][index] ?? `Data source ${index + 1}`;
  if (preset === "generic_two_file") return [`File A source`, `File B source`][index] ?? `Data source ${index + 1}`;
  return `Data source ${index + 1}`;
}

function createDataSource(file: UploadedFile, index: number, preset: PresetType): ComparisonDataSource {
  const sheet = file.sheets[0];
  const headerRow = sheet?.detected_header_row ?? 1;
  return {
    id: makeId("source"),
    name: presetLabel(preset, index),
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

function scaffoldSources(files: UploadedFile[], preset: PresetType) {
  const count = preset === "reference_bidder_abstract" ? 3 : preset === "custom_comparison_builder" ? 1 : 2;
  return files.slice(0, Math.min(count, files.length)).map((file, index) => createDataSource(file, index, preset));
}

function fieldTypeForName(fieldName: string): ComparisonField["field_type"] {
  const text = fieldName.toLowerCase();
  if (text.includes("cost") || text.includes("amount") || text.includes("price")) return "currency";
  if (text.includes("qty") || text.includes("quantity")) return "number";
  return "text";
}

function inferField(preview: DataSourcePreview, presetFieldName: string, terms: string[], dataSourceId: string): ComparisonField | null {
  const column = preview.columns.find((item) => terms.some((term) => item.header_label.toLowerCase().includes(term)));
  if (!column) return null;
  return {
    id: makeId("field"),
    data_source_id: dataSourceId,
    field_name: presetFieldName,
    field_type: fieldTypeForName(presetFieldName),
    column_letter: column.letter,
    original_header_label: column.header_label,
    custom_display_name: presetFieldName,
    required: ["Description", "Quantity"].includes(presetFieldName),
    normalization: { case_insensitive: true, trim_whitespace: true, collapse_whitespace: true },
  };
}

function makeCompareRule(leftSource: ComparisonDataSource, rightSource: ComparisonDataSource, fieldName: string): ComparisonRule | null {
  const leftField = leftSource.fields.find((item) => item.field_name.toLowerCase() === fieldName.toLowerCase());
  const rightField = rightSource.fields.find((item) => item.field_name.toLowerCase() === fieldName.toLowerCase());
  if (!leftField || !rightField) return null;
  const leftKey = leftSource.fields.find((item) => item.field_name.toLowerCase() === "item number") ?? leftField;
  const rightKey = rightSource.fields.find((item) => item.field_name.toLowerCase() === "item number") ?? rightField;
  return {
    id: makeId("rule"),
    rule_name: `${fieldName} comparison`,
    rule_type: "compare_values",
    left_data_source_id: leftSource.id,
    left_field_id: leftField.id,
    right_data_source_id: rightSource.id,
    right_field_id: rightField.id,
    left_match_field_ids: [leftKey.id],
    right_match_field_ids: [rightKey.id],
    match_strategy: leftKey.field_name === leftField.field_name ? "by_row_order" : "by_item_number_field",
    strictness: fieldName.toLowerCase().includes("cost") || fieldName.toLowerCase().includes("quantity") ? "exact" : "normalized_exact",
    numeric_tolerance: null,
    currency_tolerance: null,
    formula_settings: null,
    severity: fieldName === "Description" ? "high" : "medium",
    enabled: true,
  };
}

export function TemplateMappingPage() {
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
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!files.length || dataSources.length) return;
    setDataSources(scaffoldSources(files, preset));
  }, [files, preset, dataSources.length, setDataSources]);

  const fieldsBySource = useMemo(() => Object.fromEntries(dataSources.map((source) => [source.id, source.fields])), [dataSources]);

  if (!files.length) {
    return (
      <div>
        <PageHeader eyebrow="Step 2 of 4" title="Build comparison sources" description="Upload files before creating data sources, selecting rows, and defining rules." />
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
      setError(cause instanceof Error ? cause.message : "Could not preview this data source.");
    } finally {
      setBusy(null);
    }
  };

  const addDataSource = () => {
    const file = files[0];
    if (!file) return;
    setDataSources([...dataSources, createDataSource(file, dataSources.length, "custom_comparison_builder")]);
  };

  const applyProcurementPresetFields = (source: ComparisonDataSource) => {
    const preview = sourcePreviews[source.id];
    if (!preview) return;
    const nextFields = procurementFieldPresets
      .map((item) => inferField(preview, item.field_name, item.match, source.id))
      .filter((item): item is ComparisonField => Boolean(item));
    updateDataSource(source.id, { ...source, fields: nextFields });
  };

  const addField = (source: ComparisonDataSource) => {
    const preview = sourcePreviews[source.id];
    const firstColumn = preview?.columns.find((column) => !source.fields.some((field) => field.column_letter === column.letter)) ?? preview?.columns[0];
    if (!firstColumn) return;
    updateDataSource(source.id, {
      ...source,
      fields: [
        ...source.fields,
        {
          id: makeId("field"),
          data_source_id: source.id,
          field_name: `Field ${source.fields.length + 1}`,
          field_type: "text",
          column_letter: firstColumn.letter,
          original_header_label: firstColumn.header_label,
          custom_display_name: null,
          required: false,
          normalization: { case_insensitive: true, trim_whitespace: true, collapse_whitespace: true },
        },
      ],
    });
  };

  const buildPresetRules = () => {
    if (dataSources.length < 2) return;
    const nextRules: ComparisonRule[] = [];
    const left = dataSources[0];
    const right = dataSources[dataSources.length - 1];
    if (!left || !right) return;
    ["Description", "Quantity"].forEach((fieldName) => {
      const rule = makeCompareRule(left, right, fieldName);
      if (rule) nextRules.push(rule);
    });
    if (preset === "reference_bidder_abstract" && dataSources.length >= 3) {
      const abstract = dataSources[2];
      if (!abstract) {
        setRules(nextRules);
        return;
      }
      const quantity = abstract.fields.find((item) => item.field_name === "Quantity");
      const unitCost = abstract.fields.find((item) => item.field_name === "Unit Cost");
      const totalCost = abstract.fields.find((item) => item.field_name === "Total Cost");
      if (quantity && unitCost && totalCost) {
        nextRules.push({
          id: makeId("rule"),
          rule_name: "Abstract total formula",
          rule_type: "formula_check",
          left_data_source_id: abstract.id,
          left_field_id: totalCost.id,
          right_data_source_id: null,
          right_field_id: null,
          left_match_field_ids: [],
          right_match_field_ids: [],
          match_strategy: "by_row_order",
          strictness: "currency_tolerance",
          numeric_tolerance: null,
          currency_tolerance: "0.01",
          formula_settings: { operator: "multiply", operand_field_ids: [quantity.id, unitCost.id], result_field_id: totalCost.id },
          severity: "high",
          enabled: true,
        });
      }
    }
    setRules(nextRules);
  };

  const addRule = (ruleType: RuleType = "compare_values") => {
    const leftSource = dataSources[0];
    const rightSource = dataSources[1] ?? dataSources[0];
    const leftField = leftSource?.fields[0];
    const rightField = rightSource?.fields[0];
    const formulaFields = leftSource?.fields.slice(0, 3) ?? [];
    const [formulaLeft, formulaRight, formulaResult] = formulaFields;
    if (!leftSource || !leftField) return;
    setRules([
      ...rules,
      {
        id: makeId("rule"),
        rule_name: `Rule ${rules.length + 1}`,
        rule_type: ruleType,
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
        formula_settings: ruleType === "formula_check" && formulaLeft && formulaRight && formulaResult ? { operator: "multiply", operand_field_ids: [formulaLeft.id, formulaRight.id], result_field_id: formulaResult.id } : null,
        severity: "medium",
        enabled: true,
      },
    ]);
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
        description="Create data sources, confirm selected rows, add custom fields, and define rule-based comparisons. Presets only scaffold the builder; the backend still runs every extraction and validation."
        action={<button onClick={() => setDataSources(scaffoldSources(files, preset))} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Reset scaffold</button>}
      />

      <div className="space-y-8 pt-8">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold">Data sources</h2>
              <p className="mt-1 text-sm text-slate-600">A data source is one file, one sheet, one row selection, and its custom extracted fields.</p>
            </div>
            <button onClick={addDataSource} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">
              <Plus className="size-4" /> Add data source
            </button>
          </div>

          <div className="mt-6 space-y-6">
            {dataSources.map((source, index) => {
              const file = files.find((item) => item.id === source.file_id) ?? files[0];
              const sheets = file?.sheets ?? [];
              const preview = sourcePreviews[source.id];
              const previewHeaders = preview?.columns.map((column) => column.header_label) ?? [];

              return (
                <article key={source.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Source {index + 1}</p>
                      <h3 className="mt-1 text-base font-semibold">{source.name}</h3>
                    </div>
                    <button onClick={() => removeDataSource(source.id)} className="rounded-lg border border-slate-300 p-2 text-slate-500">
                      <Trash2 className="size-4" />
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4 xl:grid-cols-5">
                    <label className="text-xs font-semibold text-slate-700">
                      Name
                      <input value={source.name} onChange={(event) => updateDataSource(source.id, { ...source, name: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                    </label>
                    <label className="text-xs font-semibold text-slate-700">
                      File
                      <select value={source.file_id} onChange={(event) => {
                        const nextFile = files.find((item) => item.id === event.target.value) ?? files[0];
                        if (!nextFile) return;
                        const nextSheet = nextFile.sheets[0];
                        updateDataSource(source.id, {
                          ...source,
                          file_id: nextFile.id,
                          file_name: nextFile.name,
                          sheet_name: nextSheet?.name ?? "",
                          header_row: nextSheet?.detected_header_row ?? 1,
                          first_data_row: (nextSheet?.detected_header_row ?? 1) + 1,
                          selected_row_numbers: [],
                          ignored_row_numbers: [],
                        });
                      }} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                        {files.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-slate-700">
                      Sheet
                      <select value={source.sheet_name} onChange={(event) => updateDataSource(source.id, { ...source, sheet_name: event.target.value, selected_row_numbers: [] })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                        {sheets.map((sheet) => <option key={sheet.name} value={sheet.name}>{sheet.name}</option>)}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-slate-700">
                      Header row
                      <input type="number" min={1} value={source.header_row} onChange={(event) => updateDataSource(source.id, { ...source, header_row: Number(event.target.value) })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                    </label>
                    <label className="text-xs font-semibold text-slate-700">
                      First data row
                      <input type="number" min={source.header_row + 1} value={source.first_data_row} onChange={(event) => updateDataSource(source.id, { ...source, first_data_row: Number(event.target.value) })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                    </label>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={() => refreshPreview(source)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                      <RefreshCw className="size-4" /> {busy === source.id ? "Refreshing..." : "Preview rows"}
                    </button>
                    <button onClick={() => applyProcurementPresetFields(source)} disabled={!preview} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">
                      Apply procurement fields
                    </button>
                    <button onClick={() => addField(source)} disabled={!preview} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">
                      + Add field
                    </button>
                  </div>

                  {preview ? (
                    <div className="mt-5 space-y-5">
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-semibold text-slate-900">Select rows</h4>
                            <p className="text-xs text-slate-500">Auto-detection runs first. Use checkboxes to include or exclude rows manually.</p>
                          </div>
                          <span className="text-xs text-slate-500">{source.selected_row_numbers.length} selected</span>
                        </div>
                        <RowSelectionTable
                          headers={previewHeaders}
                          rows={preview.rows}
                          onToggleRow={(rowNumber) => {
                            const next = source.selected_row_numbers.includes(rowNumber)
                              ? source.selected_row_numbers.filter((item) => item !== rowNumber)
                              : [...source.selected_row_numbers, rowNumber];
                            updateDataSource(source.id, { ...source, selected_row_numbers: next, row_selection_mode: "manual_include" });
                            setSourcePreview(source.id, { ...preview, rows: preview.rows.map((row) => row.row_number === rowNumber ? { ...row, selected: !row.selected } : row) });
                          }}
                          onSelectAll={() => {
                            const next = preview.rows.map((row) => row.row_number);
                            updateDataSource(source.id, { ...source, selected_row_numbers: next, row_selection_mode: "manual_include" });
                            setSourcePreview(source.id, { ...preview, rows: preview.rows.map((row) => ({ ...row, selected: true })) });
                          }}
                          onSelectNone={() => {
                            updateDataSource(source.id, { ...source, selected_row_numbers: [], row_selection_mode: "manual_exclude" });
                            setSourcePreview(source.id, { ...preview, rows: preview.rows.map((row) => ({ ...row, selected: false })) });
                          }}
                          onInvert={() => {
                            const next = preview.rows.filter((row) => !row.selected).map((row) => row.row_number);
                            updateDataSource(source.id, { ...source, selected_row_numbers: next, row_selection_mode: "manual_include" });
                            setSourcePreview(source.id, { ...preview, rows: preview.rows.map((row) => ({ ...row, selected: !row.selected })) });
                          }}
                        />
                      </div>

                      <div>
                        <div className="mb-3 flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-semibold text-slate-900">Custom fields</h4>
                            <p className="text-xs text-slate-500">Store column letter, original header, and your own field name for each extracted value.</p>
                          </div>
                          <span className="text-xs text-slate-500">{source.fields.length} field(s)</span>
                        </div>
                        <div className="space-y-3">
                          {source.fields.map((field) => (
                            <div key={field.id} className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-3 xl:grid-cols-6">
                              <input value={field.field_name} onChange={(event) => updateDataSource(source.id, { ...source, fields: source.fields.map((item) => item.id === field.id ? { ...item, field_name: event.target.value, custom_display_name: event.target.value } : item) })} className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                              <select value={field.field_type} onChange={(event) => updateDataSource(source.id, { ...source, fields: source.fields.map((item) => item.id === field.id ? { ...item, field_type: event.target.value as ComparisonField["field_type"] } : item) })} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
                                {["text", "number", "currency", "date", "boolean", "raw"].map((value) => <option key={value} value={value}>{value}</option>)}
                              </select>
                              <select value={field.column_letter} onChange={(event) => {
                                const selectedColumn = preview.columns.find((item) => item.letter === event.target.value);
                                updateDataSource(source.id, {
                                  ...source,
                                  fields: source.fields.map((item) => item.id === field.id ? { ...item, column_letter: event.target.value, original_header_label: selectedColumn?.header_label ?? item.original_header_label } : item),
                                });
                              }} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
                                {preview.columns.map((column) => <option key={column.letter} value={column.letter}>{column.display_label}</option>)}
                              </select>
                              <label className="flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700">
                                <input type="checkbox" checked={field.required} onChange={(event) => updateDataSource(source.id, { ...source, fields: source.fields.map((item) => item.id === field.id ? { ...item, required: event.target.checked } : item) })} />
                                Required
                              </label>
                              <label className="flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700">
                                <input type="checkbox" checked={field.normalization.case_insensitive} onChange={(event) => updateDataSource(source.id, { ...source, fields: source.fields.map((item) => item.id === field.id ? { ...item, normalization: { ...item.normalization, case_insensitive: event.target.checked } } : item) })} />
                                Ignore case
                              </label>
                              <button onClick={() => updateDataSource(source.id, { ...source, fields: source.fields.filter((item) => item.id !== field.id) })} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">
                                Remove
                              </button>
                            </div>
                          ))}
                          {!source.fields.length && <p className="text-sm text-slate-500">Preview the sheet first, then add fields or apply the procurement field preset.</p>}
                        </div>
                      </div>

                      <div>
                        <div className="mb-2 flex items-center gap-2">
                          <Eye className="size-4 text-emerald-700" />
                          <h4 className="text-sm font-semibold text-slate-900">Selected-row preview</h4>
                        </div>
                        <div className="max-h-56 overflow-auto rounded-2xl border border-slate-200 bg-white">
                          <table className="w-full text-left text-xs">
                            <thead className="sticky top-0 bg-slate-100 text-slate-600">
                              <tr>
                                <th className="p-3">Row</th>
                                {source.fields.map((field) => <th key={field.id} className="p-3">{field.custom_display_name || field.field_name}</th>)}
                              </tr>
                            </thead>
                            <tbody>
                              {preview.rows.filter((row) => row.selected).slice(0, 40).map((row) => (
                                <tr key={row.row_number} className="border-t border-slate-100">
                                  <td className="p-3 font-semibold text-slate-700">{row.row_number}</td>
                                  {source.fields.map((field) => {
                                    const column = preview.columns.find((item) => item.letter === field.column_letter);
                                    return <td key={`${row.row_number}-${field.id}`} className="p-3">{String(row.cells[column?.header_label ?? ""] ?? "")}</td>;
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-500">Preview this source to load rows, detect columns, and enable field setup.</p>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Comparison rules</h2>
              <p className="mt-1 text-sm text-slate-600">Compare any field from any data source, add formula checks, or enforce required fields and duplicate detection.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={buildPresetRules} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Build preset rules</button>
              <button onClick={() => addRule("compare_values")} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">+ Add rule</button>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {rules.map((rule) => {
              const availableSources = dataSources;
              const leftSource = availableSources.find((item) => item.id === rule.left_data_source_id) ?? availableSources[0];
              const rightSource = availableSources.find((item) => item.id === rule.right_data_source_id) ?? availableSources[1] ?? availableSources[0];
              const leftFields = leftSource ? fieldsBySource[leftSource.id] ?? [] : [];
              const rightFields = rightSource ? fieldsBySource[rightSource.id] ?? [] : [];

              return (
                <div key={rule.id} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 xl:grid-cols-8">
                  <input value={rule.rule_name} onChange={(event) => updateRule(rule.id, { ...rule, rule_name: event.target.value })} className="rounded-xl border border-slate-300 px-3 py-2 text-sm xl:col-span-2" />
                  <select value={rule.rule_type} onChange={(event) => updateRule(rule.id, { ...rule, rule_type: event.target.value as RuleType })} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
                    {["compare_values", "formula_check", "required_field_check", "duplicate_check"].map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                  <select value={rule.left_data_source_id ?? ""} onChange={(event) => updateRule(rule.id, { ...rule, left_data_source_id: event.target.value })} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
                    {availableSources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
                  </select>
                  <select value={rule.left_field_id ?? ""} onChange={(event) => updateRule(rule.id, { ...rule, left_field_id: event.target.value, left_match_field_ids: [event.target.value] })} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
                    {leftFields.map((field) => <option key={field.id} value={field.id}>{field.field_name}</option>)}
                  </select>
                  <select value={rule.right_data_source_id ?? ""} onChange={(event) => updateRule(rule.id, { ...rule, right_data_source_id: event.target.value })} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
                    {availableSources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
                  </select>
                  <select value={rule.right_field_id ?? ""} onChange={(event) => updateRule(rule.id, { ...rule, right_field_id: event.target.value, right_match_field_ids: [event.target.value] })} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
                    {rightFields.map((field) => <option key={field.id} value={field.id}>{field.field_name}</option>)}
                  </select>
                  <button onClick={() => removeRule(rule.id)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">Remove</button>
                  <div className="grid gap-3 xl:col-span-8 xl:grid-cols-5">
                    <select value={rule.match_strategy} onChange={(event) => updateRule(rule.id, { ...rule, match_strategy: event.target.value as ComparisonRule["match_strategy"] })} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
                      <option value="by_row_order">By row order</option>
                      <option value="by_item_number_field">By item number field</option>
                      <option value="by_exact_text_field">By exact text field</option>
                      <option value="by_multiple_fields">By multiple fields</option>
                      <option value="manual_placeholder">Manual placeholder</option>
                    </select>
                    <select value={rule.strictness} onChange={(event) => updateRule(rule.id, { ...rule, strictness: event.target.value as ComparisonRule["strictness"] })} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
                      <option value="exact">Exact</option>
                      <option value="normalized_exact">Normalized exact</option>
                      <option value="numeric_tolerance">Numeric tolerance</option>
                      <option value="currency_tolerance">Currency tolerance</option>
                    </select>
                    <input value={rule.numeric_tolerance ?? ""} onChange={(event) => updateRule(rule.id, { ...rule, numeric_tolerance: event.target.value || null })} placeholder="Numeric tolerance" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                    <input value={rule.currency_tolerance ?? ""} onChange={(event) => updateRule(rule.id, { ...rule, currency_tolerance: event.target.value || null })} placeholder="Currency tolerance" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                    <label className="flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm">
                      <input type="checkbox" checked={rule.enabled} onChange={(event) => updateRule(rule.id, { ...rule, enabled: event.target.checked })} />
                      Enabled
                    </label>
                  </div>
                </div>
              );
            })}
            {!rules.length && <p className="text-sm text-slate-500">No rules yet. Build preset rules or add a custom rule.</p>}
          </div>
        </section>

        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <div className="flex justify-end">
          <button disabled={busy === "validation" || !dataSources.length || !rules.length} onClick={run} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
            <ArrowRight className="size-4" />
            {busy === "validation" ? "Running validation..." : "Run validation"}
          </button>
        </div>
      </div>
    </div>
  );
}
