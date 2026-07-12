import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, FileSpreadsheet, LoaderCircle, Play, RefreshCw, Rows3, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SelectField } from "../components/forms/SelectField";
import { PageHeader } from "../components/layout/PageHeader";
import { useWorkflow } from "../features/files/WorkflowContext";
import { previewDataSource } from "../services/fileApi";
import type { UploadedFile } from "../types/file.types";
import type { ComparisonDataSource, DataSourcePreview, PreviewRow } from "../types/validation.types";

interface RowSetupPageProps {
  onContinue: () => void;
}

const primaryButtonClass = "inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:active:scale-100";
const secondaryButtonClass = "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";
const setupActionButtonClass = "inline-flex items-center justify-center rounded-xl border bg-white px-3 py-2 text-xs font-semibold transition active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";

function sourceSignature(source: ComparisonDataSource) {
  return [source.file_id, source.sheet_name, source.header_row, source.first_data_row].join("|");
}

function sourceFile(source: ComparisonDataSource, files: UploadedFile[]) {
  return files.find((file) => file.id === source.file_id) ?? files[0] ?? null;
}

function clampRow(value: number) {
  return Math.max(1, Number.isFinite(value) ? Math.trunc(value) : 1);
}

function setupBoundaryRows(headerRow: number, firstDataRow: number) {
  return Array.from({ length: Math.max(firstDataRow - 1, 0) }, (_, index) => index + 1).filter((rowNumber) => rowNumber !== headerRow);
}

function applyRowBoundaries(source: ComparisonDataSource, headerRow: number, firstDataRow: number) {
  const boundaryRows = setupBoundaryRows(headerRow, firstDataRow);
  const boundarySet = new Set(boundaryRows);
  return {
    ...source,
    header_row: headerRow,
    first_data_row: firstDataRow,
    selected_row_numbers: source.selected_row_numbers.filter((rowNumber) => rowNumber >= firstDataRow),
    ignored_row_numbers: [...new Set([...source.ignored_row_numbers.filter((rowNumber) => rowNumber >= firstDataRow), ...boundaryRows])].sort((a, b) => a - b),
    row_selection_mode: boundarySet.size ? "manual_include" : source.row_selection_mode,
  };
}

function displayCell(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function rowTone(row: PreviewRow, source: ComparisonDataSource) {
  if (row.row_number === source.header_row) return "bg-sky-50/90";
  if (row.row_number === source.first_data_row) return "bg-emerald-50/90";
  if (row.selected) return "bg-emerald-50/40";
  return "bg-white";
}

function rowBadge(row: PreviewRow, source: ComparisonDataSource) {
  const className = "inline-flex w-fit max-w-full shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px]";
  if (row.row_number === source.header_row) {
    return <span className={`${className} bg-sky-100 font-semibold text-sky-700`}>Header row</span>;
  }
  if (row.row_number === source.first_data_row) {
    return <span className={`${className} bg-emerald-100 font-semibold text-emerald-700`}>First data row</span>;
  }
  if (row.ignored || row.row_number < source.first_data_row) {
    return <span className={`${className} bg-slate-100 font-medium text-slate-500`}>Excluded row</span>;
  }
  if (row.selected) {
    return <span className={`${className} bg-emerald-50 font-semibold text-emerald-700`}>Selected data</span>;
  }
  return <span className={`${className} bg-slate-100 font-medium text-slate-500`}>Preview row</span>;
}

function rowAccentClass(row: PreviewRow, source: ComparisonDataSource, selected: boolean) {
  if (selected) return "border-l-emerald-600";
  if (row.row_number === source.header_row) return "border-l-sky-500";
  if (row.row_number === source.first_data_row) return "border-l-emerald-500";
  if (row.selected) return "border-l-emerald-200";
  return "border-l-transparent";
}

function rowCellClass(selected: boolean) {
  return selected ? "border-y border-emerald-300 bg-emerald-50/95" : "border-b border-slate-100";
}

function confirmedStatus(source: ComparisonDataSource, preview?: DataSourcePreview) {
  if (source.row_setup_confirmed) {
    return {
      label: "Confirmed",
      className: "bg-emerald-50 text-emerald-700",
      icon: CheckCircle2,
      detail: "This source is ready for rows, fields, and rules.",
    };
  }
  if (preview) {
    return {
      label: "Needs confirmation",
      className: "bg-amber-50 text-amber-700",
      icon: AlertTriangle,
      detail: "Review the highlighted rows, then confirm this source.",
    };
  }
  return {
    label: "Preview needed",
    className: "bg-slate-100 text-slate-700",
    icon: Rows3,
    detail: "Load the spreadsheet preview to see the actual rows.",
  };
}

export function RowSetupPage({ onContinue }: RowSetupPageProps) {
  const {
    files,
    dataSources,
    setDataSources,
    updateDataSource,
    sourcePreviews,
    setSourcePreview,
    removeSourcePreview,
  } = useWorkflow();
  const [busySourceId, setBusySourceId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [collapsedSourceIds, setCollapsedSourceIds] = useState<Set<string>>(() => new Set());
  const [selectedRowsBySource, setSelectedRowsBySource] = useState<Record<string, number>>({});
  const autoPreviewed = useRef<Set<string>>(new Set());

  const allConfirmed = dataSources.length > 0 && dataSources.every((source) => source.row_setup_confirmed);
  const confirmedCount = dataSources.filter((source) => source.row_setup_confirmed).length;

  const loadPreview = useCallback(async (source: ComparisonDataSource) => {
    if (!source.file_id || !source.sheet_name) return;
    setBusySourceId(source.id);
    setErrors((current) => ({ ...current, [source.id]: "" }));
    try {
      const preview = await previewDataSource(source);
      updateDataSource(source.id, preview.data_source);
      setSourcePreview(source.id, preview);
      setSelectedRowsBySource((current) => ({
        ...current,
        [source.id]: current[source.id] ?? preview.data_source.header_row ?? preview.rows[0]?.row_number ?? source.header_row,
      }));
    } catch (cause) {
      setErrors((current) => ({
        ...current,
        [source.id]: cause instanceof Error ? cause.message : "Could not load the row preview.",
      }));
    } finally {
      setBusySourceId(null);
    }
  }, [setSourcePreview, updateDataSource]);

  useEffect(() => {
    dataSources.forEach((source) => {
      const signature = `${source.id}:${sourceSignature(source)}`;
      if (sourcePreviews[source.id] || autoPreviewed.current.has(signature) || busySourceId) return;
      autoPreviewed.current.add(signature);
      void loadPreview(source);
    });
  }, [busySourceId, dataSources, loadPreview, sourcePreviews]);

  const fileOptions = useMemo(
    () => files.map((file) => ({ value: file.id, label: file.name, description: `${file.extension.toUpperCase()} • ${file.sheets.length} sheet${file.sheets.length === 1 ? "" : "s"}` })),
    [files],
  );

  const updateSourceSetup = (source: ComparisonDataSource, next: ComparisonDataSource, clearPreview = true) => {
    updateDataSource(source.id, { ...next, row_setup_confirmed: false });
    if (clearPreview) removeSourcePreview(source.id);
    setSelectedRowsBySource((current) => {
      const nextRows = { ...current };
      delete nextRows[source.id];
      return nextRows;
    });
    setCollapsedSourceIds((current) => {
      const nextSet = new Set(current);
      nextSet.delete(source.id);
      return nextSet;
    });
  };

  const selectPreviewRow = (sourceId: string, rowNumber: number) => {
    setSelectedRowsBySource((current) => ({ ...current, [sourceId]: rowNumber }));
  };

  const toggleSource = (sourceId: string) => {
    setCollapsedSourceIds((current) => {
      const next = new Set(current);
      if (next.has(sourceId)) {
        next.delete(sourceId);
      } else {
        next.add(sourceId);
      }
      return next;
    });
  };

  const changeFile = (source: ComparisonDataSource, fileId: string) => {
    const file = files.find((item) => item.id === fileId);
    const sheet = file?.sheets[0];
    const headerRow = sheet?.detected_header_row ?? 1;
    updateSourceSetup(source, {
      ...source,
      file_id: file?.id ?? "",
      file_name: file?.name ?? null,
      sheet_name: sheet?.name ?? "",
      header_row: headerRow,
      first_data_row: headerRow + 1,
      selected_row_numbers: [],
      ignored_row_numbers: [],
      row_selection_mode: "auto_detected",
    });
  };

  const changeSheet = (source: ComparisonDataSource, sheetName: string) => {
    const file = sourceFile(source, files);
    const sheet = file?.sheets.find((item) => item.name === sheetName);
    const headerRow = sheet?.detected_header_row ?? 1;
    updateSourceSetup(source, {
      ...source,
      sheet_name: sheetName,
      header_row: headerRow,
      first_data_row: headerRow + 1,
      selected_row_numbers: [],
      ignored_row_numbers: [],
      row_selection_mode: "auto_detected",
    });
  };

  const changeHeaderRow = (source: ComparisonDataSource, value: number) => {
    const headerRow = clampRow(value);
    updateSourceSetup(source, applyRowBoundaries(source, headerRow, Math.max(source.first_data_row, headerRow + 1)));
  };

  const changeFirstDataRow = (source: ComparisonDataSource, value: number) => {
    const firstDataRow = Math.max(clampRow(value), source.header_row + 1);
    updateSourceSetup(source, applyRowBoundaries(source, source.header_row, firstDataRow));
  };

  const setHeaderFromRow = (source: ComparisonDataSource, rowNumber: number) => {
    const next = {
      ...applyRowBoundaries(source, rowNumber, Math.max(source.first_data_row, rowNumber + 1)),
      row_setup_confirmed: false,
    };
    updateSourceSetup(source, next, false);
    setSelectedRowsBySource((current) => ({ ...current, [source.id]: rowNumber }));
    void loadPreview(next);
  };

  const setFirstDataFromRow = (source: ComparisonDataSource, rowNumber: number) => {
    const next = {
      ...applyRowBoundaries(source, source.header_row, Math.max(rowNumber, source.header_row + 1)),
      row_setup_confirmed: false,
    };
    updateSourceSetup(source, next, false);
    setSelectedRowsBySource((current) => ({ ...current, [source.id]: rowNumber }));
    void loadPreview(next);
  };

  const confirmSource = (source: ComparisonDataSource) => {
    if (!sourcePreviews[source.id]) return;
    updateDataSource(source.id, { ...source, row_setup_confirmed: true });
  };

  const confirmAllPreviewed = () => {
    setDataSources(dataSources.map((source) => ({ ...source, row_setup_confirmed: Boolean(sourcePreviews[source.id]) })));
  };

  return (
    <div>
      <PageHeader
        eyebrow="Step 2 of 4"
        title="Confirm row setup"
        description="Check the detected header row and first data row inside Clario before building rows, fields, and rules."
        action={
          <button type="button" disabled={!allConfirmed} onClick={onContinue} className={primaryButtonClass}>
            <Play className="size-4" /> Continue to comparison builder
          </button>
        }
      />

      <div className="space-y-6 pt-6">
        <section className="rounded-3xl border border-emerald-100 bg-[linear-gradient(135deg,_rgba(16,185,129,0.12),_rgba(255,255,255,0.96))] p-5 shadow-sm" data-fade-section>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-700 text-white shadow-sm">
                <ShieldCheck className="size-5" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-slate-950">Visual row setup review</h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                  The preview below shows the spreadsheet in a file-explorer style list. Select a row, then set it as the header or first data row without opening Excel.
                </p>
              </div>
            </div>
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm">
              {confirmedCount} of {dataSources.length} confirmed
            </span>
          </div>
        </section>

        <div className="space-y-5">
          {dataSources.map((source, index) => {
            const file = sourceFile(source, files);
            const preview = sourcePreviews[source.id];
            const status = confirmedStatus(source, preview);
            const StatusIcon = status.icon;
            const sheetOptions = (file?.sheets ?? []).map((sheet) => ({ value: sheet.name, label: sheet.name, description: `${sheet.row_count} rows • ${sheet.column_count} columns` }));
            const columns = preview?.columns.slice(0, 8) ?? [];
            const hasMoreColumns = Boolean(preview && preview.columns.length > columns.length);
            const stalePreview = Boolean(preview && sourceSignature(preview.data_source) !== sourceSignature(source));
            const collapsed = collapsedSourceIds.has(source.id);
            const selectedRowNumber = selectedRowsBySource[source.id] ?? (preview?.rows.some((row) => row.row_number === source.header_row) ? source.header_row : preview?.rows[0]?.row_number);
            const selectedRowNumberValue = typeof selectedRowNumber === "number" ? selectedRowNumber : null;
            const selectedRow = selectedRowNumberValue ? preview?.rows.find((row) => row.row_number === selectedRowNumberValue) : undefined;

            return (
              <section key={source.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm" data-fade-section>
                <div className="border-b border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => toggleSource(source.id)}
                      aria-expanded={!collapsed}
                      className="group flex min-w-0 flex-1 items-start gap-3 rounded-2xl text-left outline-none transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 transition group-hover:bg-emerald-100">
                        <FileSpreadsheet className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-base font-semibold text-slate-950">{source.name}</h2>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}>
                            <StatusIcon className="size-3.5" /> {status.label}
                          </span>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-slate-500">{status.detail}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          Header row {source.header_row} · First data row {source.first_data_row} · {source.sheet_name || "No sheet selected"}
                        </p>
                      </div>
                    </button>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Source {index + 1}</span>
                      <button
                        type="button"
                        onClick={() => toggleSource(source.id)}
                        aria-label={collapsed ? `Expand ${source.name}` : `Collapse ${source.name}`}
                        className="grid size-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                      >
                        {collapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${collapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"}`}>
                  <div className="overflow-hidden">
                    <div className="grid gap-5 p-5 xl:grid-cols-[340px_minmax(0,1fr)]">
                      <div className="space-y-4">
                        <SelectField
                          ariaLabel={`${source.name} file`}
                          helpText="Choose which uploaded workbook this source should use."
                          value={source.file_id}
                          options={fileOptions}
                          onChange={(value) => changeFile(source, value)}
                        />
                        <SelectField
                          ariaLabel={`${source.name} sheet`}
                          helpText="Choose the worksheet to inspect for this source."
                          value={source.sheet_name}
                          options={sheetOptions}
                          onChange={(value) => changeSheet(source, value)}
                        />

                        <div className="grid grid-cols-2 gap-3">
                          <label className="block">
                            <span className="text-xs font-semibold text-slate-600">Header row</span>
                            <input
                              type="number"
                              min={1}
                              value={source.header_row}
                              onChange={(event) => changeHeaderRow(source, Number(event.target.value))}
                              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-emerald-600 focus:ring-3 focus:ring-emerald-100"
                            />
                          </label>
                          <label className="block">
                            <span className="text-xs font-semibold text-slate-600">First data row</span>
                            <input
                              type="number"
                              min={source.header_row + 1}
                              value={source.first_data_row}
                              onChange={(event) => changeFirstDataRow(source, Number(event.target.value))}
                              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-emerald-600 focus:ring-3 focus:ring-emerald-100"
                            />
                          </label>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                          Header row should contain column names. First data row should be the first real item row, not a title, lot header, blank row, or total row.
                        </div>

                        {errors[source.id] ? <p className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errors[source.id]}</p> : null}

                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => loadPreview(source)} disabled={busySourceId === source.id} className={secondaryButtonClass}>
                            {busySourceId === source.id ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                            {preview ? "Refresh preview" : "Load preview"}
                          </button>
                          <button type="button" onClick={() => confirmSource(source)} disabled={!preview || stalePreview} className={primaryButtonClass}>
                            <CheckCircle2 className="size-4" /> Confirm setup
                          </button>
                        </div>
                        {stalePreview ? <p className="text-xs leading-5 text-amber-700">Preview is stale. Refresh it before confirming this source.</p> : null}
                      </div>

                      <div className="min-w-0">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-semibold text-slate-900">Spreadsheet row preview</h3>
                            <p className="mt-1 text-xs leading-5 text-slate-500">Click a row to select it. Use the action bar below to set the selected row.</p>
                          </div>
                          {preview ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">Showing all {preview.rows.length} preview rows</span> : null}
                        </div>

                        {preview ? (
                          <>
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                                <span className="font-semibold text-slate-900">Selected row</span>
                                <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-slate-700 shadow-sm">
                                  {selectedRowNumberValue ? `Row ${selectedRowNumberValue}` : "Choose a row"}
                                </span>
                                {selectedRow ? rowBadge(selectedRow, source) : null}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  disabled={!selectedRowNumberValue}
                                  onClick={() => selectedRowNumberValue && setHeaderFromRow(source, selectedRowNumberValue)}
                                  className={`${setupActionButtonClass} border-sky-200 text-sky-700 hover:bg-sky-50 focus-visible:outline-sky-500`}
                                >
                                  Set selected as header
                                </button>
                                <button
                                  type="button"
                                  disabled={!selectedRowNumberValue || selectedRowNumberValue <= source.header_row}
                                  onClick={() => selectedRowNumberValue && setFirstDataFromRow(source, selectedRowNumberValue)}
                                  className={`${setupActionButtonClass} border-emerald-200 text-emerald-700 hover:bg-emerald-50 focus-visible:outline-emerald-500`}
                                >
                                  Set selected as first data
                                </button>
                              </div>
                            </div>
                            <div className="max-h-[34rem] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                              <table className="min-w-full border-separate border-spacing-0 text-left text-xs">
                                <tbody>
                                  {preview.rows.map((row) => {
                                    const selected = selectedRowNumberValue === row.row_number;
                                    const cellClass = rowCellClass(selected);
                                    return (
                                      <tr
                                        key={row.row_number}
                                        aria-selected={selected}
                                        onClick={() => selectPreviewRow(source.id, row.row_number)}
                                        className={`cursor-pointer align-top transition hover:bg-emerald-50/70 ${rowTone(row, source)}`}
                                      >
                                        <td className={`w-40 min-w-40 border-l-4 px-3 py-2.5 ${cellClass} ${rowAccentClass(row, source, selected)}`}>
                                          <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-semibold text-slate-950">Row {row.row_number}</span>
                                            {selected ? <span className="inline-flex w-fit whitespace-nowrap rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white">Selected</span> : null}
                                            {rowBadge(row, source)}
                                          </div>
                                        </td>
                                        {columns.map((column) => (
                                          <td key={`${row.row_number}-${column.letter}`} className={`min-w-36 max-w-56 px-3 py-2.5 text-slate-700 ${cellClass}`}>
                                            <span className="line-clamp-2 leading-5">{displayCell(row.cells[column.header_label])}</span>
                                          </td>
                                        ))}
                                        {hasMoreColumns ? <td className={`min-w-32 px-3 py-2.5 text-xs font-medium text-slate-400 ${cellClass}`}>+{preview.columns.length - columns.length} columns</td> : null}
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </>
                        ) : (
                          <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                            <span>
                              <Rows3 className="mx-auto size-7 text-slate-400" />
                              <span className="mt-3 block text-sm font-semibold text-slate-800">Preview not loaded yet</span>
                              <span className="mt-1 block text-sm text-slate-500">Load the preview to see the actual header and data rows.</span>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        <section className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" data-fade-section>
          <div>
            <h2 className="text-sm font-semibold text-slate-950">Ready for the comparison builder?</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Confirm every source first so fields and rules are built from the correct rows.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!dataSources.some((source) => sourcePreviews[source.id])} onClick={confirmAllPreviewed} className={secondaryButtonClass}>
              <CheckCircle2 className="size-4" /> Confirm all previewed
            </button>
            <button type="button" disabled={!allConfirmed} onClick={onContinue} className={primaryButtonClass}>
              <Play className="size-4" /> Continue to comparison builder
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
