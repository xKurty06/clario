import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, FileSpreadsheet, LoaderCircle, Play, RefreshCw, Rows3 } from "lucide-react";
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

type ReloadVisualState = "loading" | "reloaded";
type RowInputDrafts = Record<string, { headerRow?: string; firstDataRow?: string }>;
type SetupConfidenceTone = "high" | "medium" | "low";

interface SetupConfidence {
  label: string;
  score: number;
  tone: SetupConfidenceTone;
  labelClassName: string;
  barClassName: string;
  detail: string;
  checks: string[];
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

function sourceSheet(source: ComparisonDataSource, files: UploadedFile[]) {
  return sourceFile(source, files)?.sheets.find((sheet) => sheet.name === source.sheet_name) ?? null;
}

function clampRow(value: number) {
  return Math.max(1, Number.isFinite(value) ? Math.trunc(value) : 1);
}

function rowBoundaryError(source: ComparisonDataSource, files: UploadedFile[], preview?: DataSourcePreview) {
  const sheet = sourceSheet(source, files);
  const rowCount = sheet?.row_count || preview?.total_rows || (preview?.rows.length ? Math.max(...preview.rows.map((row) => row.row_number)) : undefined);
  if (source.header_row < 1) return "Header row must be 1 or higher.";
  if (source.first_data_row <= source.header_row) return "First data row must be below the header row.";
  if (!rowCount) return "";
  if (source.header_row > rowCount) return `Header row ${source.header_row} is outside this worksheet. Choose a row between 1 and ${rowCount}.`;
  if (source.first_data_row > rowCount) return `First data row ${source.first_data_row} is outside this worksheet. Choose a row between ${source.header_row + 1} and ${rowCount}.`;
  return "";
}

function setupBoundaryRows(headerRow: number, firstDataRow: number) {
  return Array.from({ length: Math.max(firstDataRow - 1, 0) }, (_, index) => index + 1).filter((rowNumber) => rowNumber !== headerRow);
}

function applyRowBoundaries(source: ComparisonDataSource, headerRow: number, firstDataRow: number): ComparisonDataSource {
  const boundaryRows = setupBoundaryRows(headerRow, firstDataRow);
  return {
    ...source,
    header_row: headerRow,
    first_data_row: firstDataRow,
    selected_row_numbers: [],
    ignored_row_numbers: boundaryRows,
    row_selection_mode: "auto_detected",
  };
}

function displayCell(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function normalizePreviewText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim().replace(/\s+/g, " ").toLowerCase();
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function meaningfulValues(row?: PreviewRow) {
  if (!row) return [];
  return Object.values(row.cells)
    .map(normalizePreviewText)
    .filter((value) => value && value !== "-" && value !== "—" && value !== "n/a");
}

function isRepeatedSectionRow(row: PreviewRow) {
  const values = meaningfulValues(row);
  return values.length >= 3 && new Set(values).size === 1;
}

function isHeaderLikeRow(row: PreviewRow, headers: string[]) {
  const values = meaningfulValues(row);
  if (!values.length) return false;
  const normalizedHeaders = headers.map(normalizePreviewText).filter(Boolean);
  const exactHits = values.filter((value) => normalizedHeaders.includes(value)).length;
  if (exactHits >= Math.min(2, values.length, normalizedHeaders.length)) return true;
  const rowText = values.join(" / ");
  const wholeWordHits = normalizedHeaders.filter((header) => new RegExp(`(?<![a-z0-9])${escapeRegex(header)}(?![a-z0-9])`).test(rowText)).length;
  return wholeWordHits >= Math.min(2, normalizedHeaders.length);
}

function sanitizeAutoDetectedPreview(preview: DataSourcePreview): DataSourcePreview {
  const source = preview.data_source;
  const headers = preview.columns.map((column) => column.header_label);
  const ignoredRows = new Set(setupBoundaryRows(source.header_row, source.first_data_row));
  const selectedRows = preview.rows
    .filter((row) => {
      if (row.row_number < source.first_data_row || ignoredRows.has(row.row_number)) return false;
      if (isRepeatedSectionRow(row)) return false;
      return meaningfulValues(row).length > 0 && !isHeaderLikeRow(row, headers);
    })
    .map((row) => row.row_number);
  const selectedRowSet = new Set(selectedRows);
  return {
    ...preview,
    data_source: {
      ...source,
      selected_row_numbers: selectedRows,
      ignored_row_numbers: [...ignoredRows].sort((a, b) => a - b),
      row_selection_mode: "auto_detected",
    },
    rows: preview.rows.map((row) => ({
      ...row,
      selected: selectedRowSet.has(row.row_number),
      ignored: ignoredRows.has(row.row_number),
    })),
    detected_selected_rows: selectedRows,
  };
}

function isVisualAutoExcludedRow(row: PreviewRow, source: ComparisonDataSource) {
  return row.row_number >= source.first_data_row && isRepeatedSectionRow(row);
}

function rowTone(row: PreviewRow, source: ComparisonDataSource, selected: boolean) {
  if (selected) return "!bg-blue-50 shadow-[inset_0_1px_0_#93c5fd,inset_0_-1px_0_#93c5fd]";
  if (row.row_number === source.header_row) return "bg-sky-50/90";
  if (row.row_number === source.first_data_row) return "bg-amber-50/90";
  if (isVisualAutoExcludedRow(row, source)) return "bg-white";
  if (row.selected) return "bg-emerald-50/40";
  return "bg-white";
}

function rowBadge(row: PreviewRow, source: ComparisonDataSource) {
  const className = "inline-flex w-fit max-w-full shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px]";
  if (row.row_number === source.header_row) return <span className={`${className} bg-sky-100 font-semibold text-sky-700`}>Header row</span>;
  if (row.row_number === source.first_data_row) return <span className={`${className} bg-amber-100 font-semibold text-amber-800`}>First data row</span>;
  if (row.ignored || row.row_number < source.first_data_row || isVisualAutoExcludedRow(row, source)) return <span className={`${className} bg-slate-100 font-medium text-slate-500`}>Excluded row</span>;
  if (row.selected) return <span className={`${className} bg-emerald-50 font-semibold text-emerald-700`}>Selected data</span>;
  return <span className={`${className} bg-slate-100 font-medium text-slate-500`}>Preview row</span>;
}

function rowAccentClass(row: PreviewRow, source: ComparisonDataSource, selected: boolean) {
  if (selected) return "!border-l-transparent";
  if (row.row_number === source.header_row) return "border-l-sky-500";
  if (row.row_number === source.first_data_row) return "border-l-amber-500";
  if (isVisualAutoExcludedRow(row, source)) return "border-l-transparent";
  if (row.selected) return "border-l-emerald-200";
  return "border-l-transparent";
}

function rowCellClass(selected: boolean) {
  return selected ? "border-y !border-blue-300 !bg-blue-50" : "border-b border-slate-100";
}

function confidenceStyle(tone: SetupConfidenceTone) {
  if (tone === "high") return { labelClassName: "text-emerald-700", barClassName: "bg-emerald-500" };
  if (tone === "medium") return { labelClassName: "text-amber-700", barClassName: "bg-amber-500" };
  return { labelClassName: "text-slate-600", barClassName: "bg-slate-400" };
}

function setupConfidence(source: ComparisonDataSource, files: UploadedFile[], preview: DataSourcePreview | undefined, stalePreview: boolean, boundaryError: string): SetupConfidence {
  if (boundaryError) {
    return {
      label: "Low confidence",
      score: 15,
      tone: "low",
      ...confidenceStyle("low"),
      detail: "Fix the row numbers before confirming this source.",
      checks: ["Header row and first data row must be inside the worksheet range."],
    };
  }

  if (!preview) {
    return {
      label: "Not checked",
      score: 0,
      tone: "low",
      ...confidenceStyle("low"),
      detail: "Load the preview so Clario can inspect the detected rows.",
      checks: ["Preview not loaded yet."],
    };
  }

  if (stalePreview) {
    return {
      label: "Needs refresh",
      score: 25,
      tone: "low",
      ...confidenceStyle("low"),
      detail: "Refresh the preview before confirming this source.",
      checks: ["Preview does not match the current row setup."],
    };
  }

  const sheet = sourceSheet(source, files);
  const headers = preview.columns.map((column) => column.header_label);
  const headerRow = preview.rows.find((row) => row.row_number === source.header_row);
  const firstDataRow = preview.rows.find((row) => row.row_number === source.first_data_row);
  const headerValues = meaningfulValues(headerRow);
  const dataValues = meaningfulValues(firstDataRow);
  const selectedRows = preview.rows.filter((row) => row.selected && !row.ignored).length;
  const checks: string[] = [];
  let score = 40;

  if (headerRow && headerValues.length >= Math.min(2, Math.max(1, preview.columns.length))) {
    score += 20;
    checks.push(`Header row ${source.header_row} has column labels.`);
  } else {
    checks.push(`Header row ${source.header_row} may be blank or incomplete.`);
  }

  if (firstDataRow && dataValues.length >= 2 && !isHeaderLikeRow(firstDataRow, headers) && !isRepeatedSectionRow(firstDataRow)) {
    score += 25;
    checks.push(`First data row ${source.first_data_row} looks like a real item row.`);
  } else {
    checks.push(`First data row ${source.first_data_row} should be reviewed.`);
  }

  if (source.first_data_row === source.header_row + 1) {
    score += 5;
    checks.push("Header and first data row are directly connected.");
  } else {
    checks.push("Rows between header and first data are excluded from validation.");
  }

  if (selectedRows > 0) {
    score += 10;
    checks.push(`${selectedRows} data row${selectedRows === 1 ? "" : "s"} detected for validation.`);
  } else {
    checks.push("No data rows were detected yet.");
  }

  if (sheet?.detected_header_row === source.header_row) score += 5;

  const finalScore = Math.min(100, score);
  const tone: SetupConfidenceTone = finalScore >= 80 ? "high" : finalScore >= 55 ? "medium" : "low";
  const label = tone === "high" ? "High confidence" : tone === "medium" ? "Medium confidence" : "Low confidence";
  const detail = tone === "high"
    ? "Header and first data row look consistent."
    : tone === "medium"
      ? "Most setup signals look usable, but review the highlighted rows."
      : "Review the highlighted rows carefully before confirming.";

  return {
    label,
    score: finalScore,
    tone,
    ...confidenceStyle(tone),
    detail,
    checks: checks.slice(0, 4),
  };
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
  const [reloadVisualStates, setReloadVisualStates] = useState<Record<string, ReloadVisualState | undefined>>({});
  const [rowInputDrafts, setRowInputDrafts] = useState<RowInputDrafts>({});
  const [expandedConfidenceSourceIds, setExpandedConfidenceSourceIds] = useState<Set<string>>(() => new Set());
  const autoPreviewed = useRef<Set<string>>(new Set());
  const reloadTimersRef = useRef<Record<string, number>>({});
  const rowInputTimersRef = useRef<Record<string, number>>({});

  const allConfirmed = dataSources.length > 0 && dataSources.every((source) => source.row_setup_confirmed);
  const confirmedCount = dataSources.filter((source) => source.row_setup_confirmed).length;
  const hasPreviewedSource = dataSources.some((source) => sourcePreviews[source.id]);

  useEffect(() => {
    return () => {
      Object.values(reloadTimersRef.current).forEach((timer) => window.clearTimeout(timer));
      Object.values(rowInputTimersRef.current).forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  const setReloadVisualState = useCallback((sourceId: string, state?: ReloadVisualState) => {
    if (reloadTimersRef.current[sourceId]) {
      window.clearTimeout(reloadTimersRef.current[sourceId]);
      delete reloadTimersRef.current[sourceId];
    }
    setReloadVisualStates((current) => ({ ...current, [sourceId]: state }));
  }, []);

  const loadPreview = useCallback(async (source: ComparisonDataSource, showReloadVisual = false) => {
    if (!source.file_id || !source.sheet_name) return;
    const boundaryError = rowBoundaryError(source, files, sourcePreviews[source.id]);
    if (boundaryError) {
      setReloadVisualState(source.id, undefined);
      setErrors((current) => ({ ...current, [source.id]: boundaryError }));
      return;
    }
    setBusySourceId(source.id);
    if (showReloadVisual) setReloadVisualState(source.id, "loading");
    setErrors((current) => ({ ...current, [source.id]: "" }));
    try {
      const rawPreview = await previewDataSource({
        ...source,
        selected_row_numbers: [],
        ignored_row_numbers: [],
        row_selection_mode: "auto_detected",
      });
      const preview = sanitizeAutoDetectedPreview(rawPreview);
      updateDataSource(source.id, {
        ...preview.data_source,
        row_setup_confirmed: Boolean(source.row_setup_confirmed),
      });
      setSourcePreview(source.id, preview);
      setSelectedRowsBySource((current) => ({
        ...current,
        [source.id]: current[source.id] ?? preview.data_source.header_row ?? preview.rows[0]?.row_number ?? source.header_row,
      }));
      if (showReloadVisual) {
        setReloadVisualState(source.id, "reloaded");
        reloadTimersRef.current[source.id] = window.setTimeout(() => {
          setReloadVisualStates((current) => ({ ...current, [source.id]: undefined }));
          delete reloadTimersRef.current[source.id];
        }, 1100);
      }
    } catch (cause) {
      if (showReloadVisual) setReloadVisualState(source.id, undefined);
      setErrors((current) => ({
        ...current,
        [source.id]: cause instanceof Error ? cause.message : "Could not load the row preview.",
      }));
    } finally {
      setBusySourceId(null);
    }
  }, [files, setReloadVisualState, setSourcePreview, sourcePreviews, updateDataSource]);

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
    for (const field of ["headerRow", "firstDataRow"] as const) {
      const timerKey = `${source.id}:${field}`;
      if (rowInputTimersRef.current[timerKey]) {
        window.clearTimeout(rowInputTimersRef.current[timerKey]);
        delete rowInputTimersRef.current[timerKey];
      }
    }
    updateDataSource(source.id, { ...next, row_setup_confirmed: false });
    if (clearPreview) removeSourcePreview(source.id);
    setRowInputDrafts((current) => {
      const nextDrafts = { ...current };
      delete nextDrafts[source.id];
      return nextDrafts;
    });
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

  const toggleConfidenceDetails = (sourceId: string) => {
    setExpandedConfidenceSourceIds((current) => {
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

  const applyRowSetupChange = (source: ComparisonDataSource, next: ComparisonDataSource, selectedRowNumber: number) => {
    const unconfirmedNext = { ...next, row_setup_confirmed: false };
    updateSourceSetup(source, unconfirmedNext, false);
    setSelectedRowsBySource((current) => ({ ...current, [source.id]: selectedRowNumber }));
    void loadPreview(unconfirmedNext, true);
  };

  const changeHeaderRow = (source: ComparisonDataSource, value: number) => {
    const headerRow = clampRow(value);
    const next = applyRowBoundaries(source, headerRow, Math.max(source.first_data_row, headerRow + 1));
    applyRowSetupChange(source, next, headerRow);
  };

  const changeFirstDataRow = (source: ComparisonDataSource, value: number) => {
    const firstDataRow = Math.max(clampRow(value), source.header_row + 1);
    const next = applyRowBoundaries(source, source.header_row, firstDataRow);
    applyRowSetupChange(source, next, firstDataRow);
  };

  const clearRowInputDraft = (sourceId: string, field: "headerRow" | "firstDataRow") => {
    setRowInputDrafts((current) => {
      const sourceDraft = { ...current[sourceId] };
      delete sourceDraft[field];
      const next = { ...current };
      if (sourceDraft.headerRow === undefined && sourceDraft.firstDataRow === undefined) {
        delete next[sourceId];
      } else {
        next[sourceId] = sourceDraft;
      }
      return next;
    });
  };

  const clearRowInputTimer = (sourceId: string, field: "headerRow" | "firstDataRow") => {
    const timerKey = `${sourceId}:${field}`;
    if (rowInputTimersRef.current[timerKey]) {
      window.clearTimeout(rowInputTimersRef.current[timerKey]);
      delete rowInputTimersRef.current[timerKey];
    }
  };

  const commitRowInputValue = (source: ComparisonDataSource, field: "headerRow" | "firstDataRow", value: string) => {
    const parsed = Number.parseInt(value, 10);
    clearRowInputDraft(source.id, field);
    if (!Number.isInteger(parsed)) return;
    if (field === "headerRow") {
      changeHeaderRow(source, parsed);
    } else {
      changeFirstDataRow(source, parsed);
    }
  };

  const updateRowInputDraft = (source: ComparisonDataSource, field: "headerRow" | "firstDataRow", value: string) => {
    if (value && !/^\d+$/.test(value)) return;
    clearRowInputTimer(source.id, field);
    setRowInputDrafts((current) => ({
      ...current,
      [source.id]: {
        ...current[source.id],
        [field]: value,
      },
    }));
    if (!value) return;
    const timerKey = `${source.id}:${field}`;
    rowInputTimersRef.current[timerKey] = window.setTimeout(() => {
      delete rowInputTimersRef.current[timerKey];
      commitRowInputValue(source, field, value);
    }, 1000);
  };

  const commitRowInputDraft = (source: ComparisonDataSource, field: "headerRow" | "firstDataRow") => {
    clearRowInputTimer(source.id, field);
    const value = rowInputDrafts[source.id]?.[field];
    if (value === undefined) return;
    commitRowInputValue(source, field, value);
  };

  const setHeaderFromRow = (source: ComparisonDataSource, rowNumber: number) => {
    const next = applyRowBoundaries(source, rowNumber, Math.max(source.first_data_row, rowNumber + 1));
    applyRowSetupChange(source, next, rowNumber);
  };

  const setFirstDataFromRow = (source: ComparisonDataSource, rowNumber: number) => {
    const firstDataRow = Math.max(rowNumber, source.header_row + 1);
    const next = applyRowBoundaries(source, source.header_row, firstDataRow);
    applyRowSetupChange(source, next, firstDataRow);
  };

  const confirmSource = (source: ComparisonDataSource) => {
    if (!sourcePreviews[source.id]) return;
    if (rowBoundaryError(source, files, sourcePreviews[source.id])) return;
    updateDataSource(source.id, { ...source, row_setup_confirmed: true });
  };

  const confirmAllPreviewed = () => {
    setDataSources(dataSources.map((source) => {
      const preview = sourcePreviews[source.id];
      const hasCurrentPreview = Boolean(preview && sourceSignature(preview.data_source) === sourceSignature(source));
      return {
        ...source,
        row_setup_confirmed: hasCurrentPreview && !rowBoundaryError(source, files, preview),
      };
    }));
  };

  return (
    <div>
      <PageHeader
        eyebrow="Step 2 of 4"
        title="Confirm row setup"
        description="Check the detected header row and first data row inside Clario before building rows, fields, and rules."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              {confirmedCount} of {dataSources.length} confirmed
            </span>
            <button type="button" disabled={!hasPreviewedSource} onClick={confirmAllPreviewed} className={secondaryButtonClass}>
              <CheckCircle2 className="size-4" /> Confirm all previewed
            </button>
            <button type="button" disabled={!allConfirmed} onClick={onContinue} className={primaryButtonClass}>
              <Play className="size-4" /> Continue to comparison builder
            </button>
          </div>
        }
      />

      <div className="space-y-6 pt-6">
        <div className="space-y-5">
          {dataSources.map((source, index) => {
            const file = sourceFile(source, files);
            const sheet = sourceSheet(source, files);
            const preview = sourcePreviews[source.id];
            const status = confirmedStatus(source, preview);
            const StatusIcon = status.icon;
            const sheetOptions = (file?.sheets ?? []).map((sheet) => ({ value: sheet.name, label: sheet.name, description: `${sheet.row_count} rows • ${sheet.column_count} columns` }));
            const columns = preview?.columns ?? [];
            const stalePreview = Boolean(preview && sourceSignature(preview.data_source) !== sourceSignature(source));
            const collapsed = collapsedSourceIds.has(source.id);
            const selectedRowNumber = selectedRowsBySource[source.id] ?? (preview?.rows.some((row) => row.row_number === source.header_row) ? source.header_row : preview?.rows[0]?.row_number);
            const selectedRowNumberValue = typeof selectedRowNumber === "number" ? selectedRowNumber : null;
            const selectedRow = selectedRowNumberValue ? preview?.rows.find((row) => row.row_number === selectedRowNumberValue) : undefined;
            const reloadState = reloadVisualStates[source.id];
            const rowInputDraft = rowInputDrafts[source.id] ?? {};
            const boundaryError = rowBoundaryError(source, files, preview);
            const sourceError = boundaryError || errors[source.id];
            const rowInputInvalidClass = boundaryError ? "border-red-300 focus:border-red-500 focus:ring-red-100" : "border-slate-300 focus:border-emerald-600 focus:ring-emerald-100";
            const maxRowNumber = sheet?.row_count || preview?.total_rows;
            const confidence = setupConfidence(source, files, preview, stalePreview, boundaryError);
            const confidenceExpanded = expandedConfidenceSourceIds.has(source.id);
            const confidenceDetailsId = `confidence-details-${source.id}`;

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
                          <span className={`text-xs font-semibold ${confidence.labelClassName}`}>
                            {confidence.label}
                          </span>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-slate-500">{status.detail}</p>
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
                        <div className="rounded-2xl border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-600 shadow-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`font-semibold ${confidence.labelClassName}`}>{confidence.label}</span>
                            <span className="font-semibold text-slate-700">{confidence.score}%</span>
                          </div>
                          <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100">
                            <div className={`h-full rounded-full transition-all ${confidence.barClassName}`} style={{ width: `${confidence.score}%` }} />
                          </div>
                          <p className="mt-2 text-slate-500">{confidence.detail}</p>
                          <button
                            type="button"
                            onClick={() => toggleConfidenceDetails(source.id)}
                            aria-expanded={confidenceExpanded}
                            aria-controls={confidenceDetailsId}
                            className="mt-1 text-[11px] font-semibold text-emerald-700 transition hover:text-emerald-800"
                          >
                            {confidenceExpanded ? "Hide details" : "View details"}
                          </button>
                          <div
                            id={confidenceDetailsId}
                            aria-hidden={!confidenceExpanded}
                            className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${confidenceExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                          >
                            <div className="overflow-hidden">
                              <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                                {confidence.checks.map((check) => <li key={check}>- {check}</li>)}
                              </ul>
                            </div>
                          </div>
                        </div>

                        <label className="block">
                          <span className="text-xs font-semibold text-slate-600">Workbook file</span>
                          <SelectField
                            ariaLabel={`${source.name} file`}
                            className="mt-1"
                            helpText="Choose which uploaded workbook this source should use."
                            value={source.file_id}
                            options={fileOptions}
                            onChange={(value) => changeFile(source, value)}
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-semibold text-slate-600">Worksheet tab</span>
                          <SelectField
                            ariaLabel={`${source.name} sheet`}
                            className="mt-1"
                            helpText="Choose the worksheet to inspect for this source."
                            value={source.sheet_name}
                            options={sheetOptions}
                            onChange={(value) => changeSheet(source, value)}
                          />
                        </label>

                        <div className="grid grid-cols-2 gap-3">
                          <label className="block">
                            <span className="text-xs font-semibold text-slate-600">Header row</span>
                            <input
                              type="number"
                              min={1}
                              max={maxRowNumber}
                              value={rowInputDraft.headerRow ?? String(source.header_row)}
                              onChange={(event) => updateRowInputDraft(source, "headerRow", event.target.value)}
                              onBlur={() => commitRowInputDraft(source, "headerRow")}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") event.currentTarget.blur();
                              }}
                              className={`mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-semibold outline-none transition focus:ring-3 ${rowInputInvalidClass}`}
                            />
                          </label>
                          <label className="block">
                            <span className="text-xs font-semibold text-slate-600">First data row</span>
                            <input
                              type="number"
                              min={source.header_row + 1}
                              max={maxRowNumber}
                              value={rowInputDraft.firstDataRow ?? String(source.first_data_row)}
                              onChange={(event) => updateRowInputDraft(source, "firstDataRow", event.target.value)}
                              onBlur={() => commitRowInputDraft(source, "firstDataRow")}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") event.currentTarget.blur();
                              }}
                              className={`mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-semibold outline-none transition focus:ring-3 ${rowInputInvalidClass}`}
                            />
                          </label>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                          Header row should contain column names. First data row should be the first real item row, not a title, lot header, blank row, or total row.
                        </div>

                        {sourceError ? <p className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{sourceError}</p> : null}

                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => loadPreview(source, true)} disabled={busySourceId === source.id || Boolean(boundaryError)} className={secondaryButtonClass}>
                            {busySourceId === source.id ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                            {busySourceId === source.id ? "Reloading..." : preview ? "Refresh preview" : "Load preview"}
                          </button>
                          <button
                            type="button"
                            onClick={() => confirmSource(source)}
                            disabled={source.row_setup_confirmed || !preview || stalePreview || Boolean(boundaryError)}
                            className={source.row_setup_confirmed ? "inline-flex cursor-default items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700" : primaryButtonClass}
                          >
                            <CheckCircle2 className="size-4" /> {source.row_setup_confirmed ? "Confirmed" : "Confirm setup"}
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
                            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-3 py-3">
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
                                    className={`${setupActionButtonClass} border-amber-200 text-amber-800 hover:bg-amber-50 focus-visible:outline-amber-500`}
                                  >
                                    Set selected as first data
                                  </button>
                                </div>
                              </div>
                              <div className={`max-h-[34rem] overflow-auto transition duration-300 ${reloadState === "loading" ? "scale-[0.998] opacity-65 blur-[0.7px] saturate-[0.96]" : reloadState === "reloaded" ? "shadow-[inset_0_0_0_1px_rgba(16,185,129,0.28),0_16px_40px_rgba(16,185,129,0.08)]" : ""}`}>
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
                                          className={`cursor-pointer align-top transition hover:bg-blue-50/70 ${rowTone(row, source, selected)}`}
                                        >
                                          <td className={`w-40 min-w-40 border-l-4 px-3 py-2.5 ${cellClass} ${rowAccentClass(row, source, selected)}`}>
                                            <div className="flex flex-wrap items-center gap-2">
                                              <span className="font-semibold text-slate-950">Row {row.row_number}</span>
                                              {rowBadge(row, source)}
                                            </div>
                                          </td>
                                          {columns.map((column) => (
                                            <td key={`${row.row_number}-${column.letter}`} className={`min-w-52 px-3 py-2.5 text-slate-700 ${cellClass}`}>
                                              <span className="block whitespace-normal leading-5">{displayCell(row.cells[column.header_label])}</span>
                                            </td>
                                          ))}
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                              {reloadState ? (
                                <div className={`pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl transition duration-300 ${reloadState === "loading" ? "bg-white/60 backdrop-blur-[2px]" : "bg-emerald-50/45"}`}>
                                  <div className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold shadow-lg shadow-slate-200/60 animate-[app-section-fade-in_180ms_cubic-bezier(0.16,1,0.3,1)_both] ${reloadState === "loading" ? "border-slate-200 bg-white text-slate-700" : "border-emerald-100 bg-white text-emerald-700"}`}>
                                    {reloadState === "loading" ? <LoaderCircle className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                                    {reloadState === "loading" ? "Reloading preview..." : "Preview reloaded"}
                                  </div>
                                </div>
                              ) : null}
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
            <button type="button" disabled={!hasPreviewedSource} onClick={confirmAllPreviewed} className={secondaryButtonClass}>
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
