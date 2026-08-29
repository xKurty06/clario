import { Search, Wand2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useWorkflow } from "../../features/files/WorkflowContext";
import type { ComparisonDataSource, ComparisonField } from "../../types/validation.types";
import { buildSuggestedFieldsForSource, normalizedFieldKey } from "../../utils/fieldSuggestions";

interface FieldChoice {
  key: string;
  inferredField: ComparisonField;
}

const primaryButtonClass = "inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300";
const secondaryButtonClass = "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50";

export function CommonFieldsChooser() {
  const { dataSources, sourcePreviews, updateDataSource } = useWorkflow();
  const [targetSourceId, setTargetSourceId] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  const targetSource = targetSourceId ? dataSources.find((source) => source.id === targetSourceId) ?? null : null;
  const preview = targetSource ? sourcePreviews[targetSource.id] : undefined;

  const choices = useMemo<FieldChoice[]>(() => {
    if (!targetSource || !preview) return [];
    return buildSuggestedFieldsForSource(targetSource, preview, sourcePreviews).map((inferredField) => ({
      key: `${inferredField.column_letter}:${normalizedFieldKey(inferredField.field_name)}`,
      inferredField,
    }));
  }, [preview, sourcePreviews, targetSource]);

  const selectableKeys = choices.map((choice) => choice.key);
  const selectedFields = choices
    .filter((choice) => selectedKeys.includes(choice.key))
    .map((choice) => choice.inferredField);

  useEffect(() => {
    const openForSourceId = (sourceId: string) => {
      const source = dataSources.find((item) => item.id === sourceId);
      if (!source) return;
      setTargetSourceId(source.id);
    };

    const openFromCustomEvent = (event: Event) => {
      const sourceId = (event as CustomEvent<{ sourceId?: string }>).detail?.sourceId;
      if (!sourceId) return;
      openForSourceId(sourceId);
    };

    window.addEventListener("clario:suggest-fields", openFromCustomEvent);
    return () => window.removeEventListener("clario:suggest-fields", openFromCustomEvent);
  }, [dataSources]);

  useEffect(() => {
    if (!targetSourceId) return;
    setSelectedKeys(selectableKeys);
  }, [targetSourceId, selectableKeys.join("|")]);

  if (!targetSource) return null;

  const close = () => {
    setTargetSourceId(null);
    setSelectedKeys([]);
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
                Select which suggested fields should be added to <span className="font-semibold text-slate-900">{targetSource.name}</span>.
              </p>
            </div>
          </div>
          <button type="button" aria-label="Close" title="Close" onClick={close} className="grid size-9 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">
            <X className="size-4" />
          </button>
        </div>

        {!preview ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Load a preview for this source before suggesting fields.
          </div>
        ) : (
          <>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-500">Related column names are prioritized, then useful headers from this source are offered. Existing mappings are kept.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setSelectedKeys(selectableKeys)} className={secondaryButtonClass}>Select all available</button>
                <button type="button" onClick={() => setSelectedKeys([])} className={secondaryButtonClass}>Clear</button>
              </div>
            </div>

            {choices.length ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {choices.map((choice) => {
                  const checked = selectedKeys.includes(choice.key);
                  const field = choice.inferredField;
                  return (
                    <label
                      key={choice.key}
                      className={`flex cursor-pointer gap-3 rounded-2xl border p-4 text-sm transition ${checked ? "border-emerald-200 bg-emerald-50 hover:border-blue-300 hover:bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}
                      title={`Add ${field.field_name}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          const nextChecked = event.target.checked;
                          setSelectedKeys((current) => nextChecked
                            ? [...new Set([...current, choice.key])]
                            : current.filter((key) => key !== choice.key));
                        }}
                        className="mt-1 size-4 rounded border-slate-300 accent-emerald-700"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-slate-950">
                          {field.field_name}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-slate-500">
                          Column {field.column_letter} / {field.original_header_label || "Blank header"}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                No usable column headers were found for this source. Add fields manually or review the selected header row.
              </div>
            )}
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
