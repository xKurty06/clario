import { Search, Wand2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useWorkflow } from "../../features/files/WorkflowContext";
import type { ComparisonDataSource, ComparisonField, DataSourcePreview, FieldType } from "../../types/validation.types";

interface CommonFieldTemplate {
  field_name: string;
  match: string[];
}

interface FieldChoice {
  template: CommonFieldTemplate;
  inferredField: ComparisonField | null;
  disabledReason: string;
}

const commonFields: CommonFieldTemplate[] = [
  { field_name: "Item Number", match: ["item", "no"] },
  { field_name: "Description", match: ["description", "particular", "specification"] },
  { field_name: "Quantity", match: ["qty", "quantity"] },
  { field_name: "Unit", match: ["unit", "uom"] },
  { field_name: "Unit Cost", match: ["unit cost", "unit price", "price"] },
  { field_name: "Total Cost", match: ["total", "amount"] },
];

const primaryButtonClass = "inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300";
const secondaryButtonClass = "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50";

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function fieldTypeForName(fieldName: string): FieldType {
  const text = fieldName.toLowerCase();
  if (text.includes("cost") || text.includes("amount") || text.includes("price")) return "currency";
  if (text.includes("qty") || text.includes("quantity")) return "number";
  return "text";
}

function inferField(preview: DataSourcePreview, template: CommonFieldTemplate, dataSourceId: string): ComparisonField | null {
  const column = preview.columns.find((item) => template.match.some((term) => item.header_label.toLowerCase().includes(term)));
  if (!column) return null;
  return {
    id: makeId("field"),
    data_source_id: dataSourceId,
    field_name: template.field_name,
    field_type: fieldTypeForName(template.field_name),
    column_letter: column.letter,
    original_header_label: column.header_label,
    custom_display_name: template.field_name,
    required: true,
    normalization: { case_insensitive: true, trim_whitespace: true, collapse_whitespace: true },
  };
}

function findSourceFromButton(button: HTMLButtonElement, sources: ComparisonDataSource[]) {
  const article = button.closest("article");
  const heading = article?.querySelector("h2")?.textContent?.trim();
  if (!heading) return null;
  return sources.find((source) => source.name === heading) ?? null;
}

export function CommonFieldsChooser() {
  const { dataSources, sourcePreviews, updateDataSource } = useWorkflow();
  const [targetSourceId, setTargetSourceId] = useState<string | null>(null);
  const [selectedNames, setSelectedNames] = useState<string[]>([]);

  const targetSource = targetSourceId ? dataSources.find((source) => source.id === targetSourceId) ?? null : null;
  const preview = targetSource ? sourcePreviews[targetSource.id] : undefined;

  const choices = useMemo<FieldChoice[]>(() => {
    if (!targetSource || !preview) return [];
    const existingFieldNames = new Set(targetSource.fields.map((field) => field.field_name.toLowerCase()));
    const existingColumns = new Set(targetSource.fields.map((field) => field.column_letter.toUpperCase()));

    return commonFields.map((template) => {
      if (existingFieldNames.has(template.field_name.toLowerCase())) {
        return { template, inferredField: null, disabledReason: "Already added" };
      }

      const inferredField = inferField(preview, template, targetSource.id);
      if (!inferredField) {
        return { template, inferredField: null, disabledReason: "No matching column found" };
      }

      if (existingColumns.has(inferredField.column_letter.toUpperCase())) {
        return { template, inferredField: null, disabledReason: `Column ${inferredField.column_letter} is already mapped` };
      }

      return { template, inferredField, disabledReason: "" };
    });
  }, [preview, targetSource]);

  const selectableNames = choices.filter((choice) => choice.inferredField).map((choice) => choice.template.field_name);
  const selectedFields = choices
    .filter((choice) => choice.inferredField && selectedNames.includes(choice.template.field_name))
    .map((choice) => choice.inferredField as ComparisonField);

  useEffect(() => {
    const interceptCommonFieldButton = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target || target.closest("[data-common-field-chooser]")) return;

      const button = target.closest("button") as HTMLButtonElement | null;
      if (!button?.textContent?.includes("Apply common procurement fields")) return;

      const source = findSourceFromButton(button, dataSources);
      if (!source) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setTargetSourceId(source.id);
    };

    document.addEventListener("click", interceptCommonFieldButton, true);
    return () => document.removeEventListener("click", interceptCommonFieldButton, true);
  }, [dataSources]);

  useEffect(() => {
    if (!targetSourceId) return;
    setSelectedNames(selectableNames);
  }, [targetSourceId, selectableNames.join("|")]);

  if (!targetSource) return null;

  const close = () => {
    setTargetSourceId(null);
    setSelectedNames([]);
  };

  const applySelectedFields = () => {
    if (!selectedFields.length) return;
    updateDataSource(targetSource.id, { ...targetSource, fields: [...targetSource.fields, ...selectedFields] });
    close();
  };

  return (
    <div data-common-field-chooser className="fixed inset-0 z-[70] flex items-center justify-center px-4">
      <button aria-label="Close common field chooser" className="absolute inset-0 bg-slate-950/35 backdrop-blur-[2px]" onClick={close} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="common-fields-title"
        className="relative w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl animate-[builder-dialog-in_180ms_cubic-bezier(0.16,1,0.3,1)_forwards]"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Wand2 className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 id="common-fields-title" className="text-lg font-semibold text-slate-950">Choose fields to add</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Select which common procurement fields should be added to <span className="font-semibold text-slate-900">{targetSource.name}</span>.
              </p>
            </div>
          </div>
          <button type="button" aria-label="Close" title="Close" onClick={close} className="grid size-9 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">
            <X className="size-4" />
          </button>
        </div>

        {!preview ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Load a preview for this source before applying common fields.
          </div>
        ) : (
          <>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-500">Fields are suggested from detected headers. Existing mappings are kept.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setSelectedNames(selectableNames)} className={secondaryButtonClass}>Select all available</button>
                <button type="button" onClick={() => setSelectedNames([])} className={secondaryButtonClass}>Clear</button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {choices.map((choice) => {
                const checked = selectedNames.includes(choice.template.field_name);
                const disabled = !choice.inferredField;
                return (
                  <label
                    key={choice.template.field_name}
                    className={`flex gap-3 rounded-2xl border p-4 text-sm transition ${disabled ? "border-slate-200 bg-slate-50 opacity-65" : checked ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}
                    title={choice.disabledReason || `Add ${choice.template.field_name}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={(event) => {
                        const nextChecked = event.target.checked;
                        setSelectedNames((current) => nextChecked
                          ? [...new Set([...current, choice.template.field_name])]
                          : current.filter((name) => name !== choice.template.field_name));
                      }}
                      className="mt-1 size-4 rounded border-slate-300 accent-emerald-700"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-slate-950">
                        {choice.template.field_name}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">
                        {choice.inferredField
                          ? `Column ${choice.inferredField.column_letter} / ${choice.inferredField.original_header_label || "Blank header"}`
                          : choice.disabledReason}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Search className="size-4" />
            {selectedFields.length} field{selectedFields.length === 1 ? "" : "s"} selected
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={close} className={secondaryButtonClass}>Cancel</button>
            <button type="button" disabled={!preview || !selectedFields.length} onClick={applySelectedFields} className={primaryButtonClass}>
              Add selected fields
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
