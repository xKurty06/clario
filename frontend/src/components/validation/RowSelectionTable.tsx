import { AlertTriangle, Ban, CheckSquare, ChevronDown, MoreHorizontal, RotateCcw, Square } from "lucide-react";
import { useId, useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
import type { PreviewRow } from "../../types/validation.types";

interface RowSelectionTableProps {
  headers: string[];
  rows: PreviewRow[];
  lockedRowNumbers?: number[];
  headerRowNumber?: number;
  onToggleRow: (rowNumber: number) => void;
  onSelectRows: (rowNumbers: number[]) => void;
  onIgnoreRows: (rowNumbers: number[]) => void;
  onMarkDataRows: (rowNumbers: number[]) => void;
}

interface RowWarning {
  rowNumber: number;
  reason: string;
}

const toolbarButtonClass = "inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50";
const rangeInputClass = "h-8 w-20 rounded-lg border border-slate-200 bg-white px-2 text-center text-xs font-semibold text-slate-800 outline-none placeholder:font-medium placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";
const menuItemClass = "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus:bg-slate-50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50";
const menuSectionClass = "px-3 pt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400";
const rowCellClass = "border-b border-slate-100 p-2.5 align-middle text-[13px] font-medium leading-5 text-slate-800 subpixel-antialiased";
const summaryTerms = ["grand total", "subtotal", "total"];
const sectionTerms = ["lot", "section", "category"];
const footerTerms = ["signature", "prepared by", "approved by", "certified by", "noted by", "checked by"];

function rowValues(row: PreviewRow) {
  return Object.values(row.cells).map((value) => String(value ?? "").trim());
}

function meaningfulValues(row: PreviewRow) {
  return rowValues(row).filter((value) => value.length > 0 && value !== "-" && value !== "—" && value.toLowerCase() !== "n/a");
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function rowText(row: PreviewRow) {
  return meaningfulValues(row).join(" ").trim();
}

function leadingText(row: PreviewRow) {
  return meaningfulValues(row).slice(0, 4).join(" ").trim();
}

function containsTerm(text: string, term: string) {
  return new RegExp(`(^|\\s)${term.replace(/\s+/g, "\\s+")}(\\s|$)`, "i").test(text);
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

function looksLikeHeaderRow(values: string[], headers: string[]) {
  if (headers.length < 2 || values.length < 2) return false;
  const normalizedHeaders = new Set(headers.map(normalizeText).filter(Boolean));
  const exactHeaderHits = values.map(normalizeText).filter((value) => normalizedHeaders.has(value)).length;
  return exactHeaderHits >= Math.min(2, normalizedHeaders.size);
}

function looksLikeSummaryOrSectionRow(row: PreviewRow, term: string) {
  const values = meaningfulValues(row);
  const allText = normalizeText(rowText(row));
  const leadText = normalizeText(leadingText(row));
  if (!containsTerm(allText, term)) return false;
  return containsTerm(leadText, term) || values.length <= 3 || looksLikeRepeatedLabelRow(values);
}

function rowWarning(row: PreviewRow, headers: string[], headerRowNumber?: number): string | null {
  if (!row.selected) return null;
  const values = meaningfulValues(row);
  const allText = normalizeText(rowText(row));
  const leadText = normalizeText(leadingText(row));
  const nonEmptyRatio = values.length / Math.max(1, Object.keys(row.cells).length);

  if (row.row_number === headerRowNumber) return "selected header row";
  if (!values.length) return "blank selected row";
  if (values.length <= 1 || nonEmptyRatio < 0.2) return "mostly empty selected row";
  if (looksLikeHeaderRow(values, headers)) return "looks like a header row";
  if (looksLikeRepeatedLabelRow(values)) return "repeated label row";

  const footerTerm = footerTerms.find((term) => containsTerm(allText, term));
  if (footerTerm) return `contains “${footerTerm}”`;

  const summaryTerm = summaryTerms.find((term) => looksLikeSummaryOrSectionRow(row, term));
  if (summaryTerm) return `summary row: “${summaryTerm}”`;

  const sectionTerm = sectionTerms.find((term) => containsTerm(leadText, term) && values.length <= 4);
  if (sectionTerm) return `section row: “${sectionTerm}”`;

  return null;
}

function rowStatus(row: PreviewRow, headers: string[], headerRowNumber?: number) {
  const warning = rowWarning(row, headers, headerRowNumber);
  if (warning) return { label: "Review row", className: "bg-amber-50 text-amber-800 ring-1 ring-amber-200" };
  const text = rowText(row);
  if (row.row_number === headerRowNumber) return { label: "Header row", className: "bg-sky-100 text-sky-700" };
  if (row.selected) return { label: "Included", className: "bg-emerald-50 text-emerald-700" };
  if (row.ignored) return { label: "Excluded", className: "bg-slate-100 text-slate-600" };
  if (!text) return { label: "Blank", className: "bg-zinc-100 text-zinc-600" };
  if (looksLikeHeaderRow(meaningfulValues(row), headers)) return { label: "Header-like", className: "bg-amber-50 text-amber-700" };
  return { label: "Not included", className: "bg-slate-50 text-slate-500" };
}

function rowsMatchingSummaryTerm(rows: PreviewRow[], term: string) {
  return rows.filter((row) => looksLikeSummaryOrSectionRow(row, term)).map((row) => row.row_number);
}

function rowWarningSummary(warnings: RowWarning[]) {
  if (!warnings.length) return "";
  const rows = warnings.slice(0, 3).map((warning) => `Row ${warning.rowNumber}`).join(", ");
  const extra = warnings.length > 3 ? ` +${warnings.length - 3}` : "";
  return `${warnings.length} row${warnings.length === 1 ? "" : "s"} to review: ${rows}${extra}`;
}

export function RowSelectionTable({ headers, rows, lockedRowNumbers = [], headerRowNumber, onToggleRow, onSelectRows, onIgnoreRows, onMarkDataRows }: RowSelectionTableProps) {
  const rowRangeStartId = useId();
  const rowRangeEndId = useId();
  const lockedRows = new Set([...lockedRowNumbers, ...(headerRowNumber ? [headerRowNumber] : [])]);
  const selectableRows = rows.filter((row) => !lockedRows.has(row.row_number));
  const selectableRowNumbers = selectableRows.map((row) => row.row_number);
  const selectedRows = selectableRows.filter((row) => row.selected).map((row) => row.row_number);
  const blankRows = selectableRows.filter((row) => !rowText(row)).map((row) => row.row_number);
  const selectedRowWarnings = useMemo<RowWarning[]>(
    () => rows
      .map((row) => ({ rowNumber: row.row_number, reason: rowWarning(row, headers, headerRowNumber) }))
      .filter((warning): warning is RowWarning => Boolean(warning.reason)),
    [headerRowNumber, headers, rows],
  );
  const warningRowSet = useMemo(() => new Set(selectedRowWarnings.map((warning) => warning.rowNumber)), [selectedRowWarnings]);
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [rangeError, setRangeError] = useState("");
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);

  const handleSelectRange = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const start = Number.parseInt(rangeStart, 10);
    const end = Number.parseInt(rangeEnd, 10);

    if (!Number.isInteger(start) || !Number.isInteger(end)) {
      setRangeError("Enter valid Excel row numbers.");
      return;
    }

    const lower = Math.min(start, end);
    const upper = Math.max(start, end);
    const rowsInRange = selectableRows.filter((row) => row.row_number >= lower && row.row_number <= upper).map((row) => row.row_number);

    if (!rowsInRange.length) {
      setRangeError(`No preview rows found from Excel row ${lower} to ${upper}.`);
      return;
    }

    onSelectRows([...new Set([...selectedRows, ...rowsInRange])]);
    setRangeError("");
    setMoreActionsOpen(false);
  };

  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, rowNumber: number) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (lockedRows.has(rowNumber)) return;
    event.preventDefault();
    onToggleRow(rowNumber);
  };

  const runMoreAction = (action: () => void) => {
    action();
    setMoreActionsOpen(false);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white font-sans text-slate-900 subpixel-antialiased [text-rendering:optimizeLegibility]">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-2xl border-b border-slate-200 bg-white p-3 text-xs text-slate-700">
        <div className="min-w-0">
          <p className="font-semibold text-slate-950">{selectedRows.length} of {selectableRowNumbers.length} row{selectableRowNumbers.length === 1 ? "" : "s"} included</p>
          <p className="mt-0.5 text-[11px] font-medium leading-4 text-slate-600">Click rows to include or exclude them from validation.</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button type="button" title="Include all rows in this preview" aria-label="Include all rows in this preview" onClick={() => onSelectRows(selectableRowNumbers)} className={toolbarButtonClass}>
            <CheckSquare className="size-3.5" /> Select all
          </button>
          <button type="button" title="Clear the current row selection" aria-label="Clear the current row selection" onClick={() => onSelectRows([])} className={toolbarButtonClass}>
            <Square className="size-3.5" /> Select none
          </button>
          <div className="relative">
            <button
              type="button"
              title="Open row range, invert, cleanup, and include/exclude actions"
              aria-label="Open more row actions"
              aria-haspopup="menu"
              aria-expanded={moreActionsOpen}
              onClick={() => setMoreActionsOpen((open) => !open)}
              className={toolbarButtonClass}
            >
              <MoreHorizontal className="size-3.5" /> More <ChevronDown className={`size-3.5 transition ${moreActionsOpen ? "rotate-180" : ""}`} />
            </button>
            {moreActionsOpen ? (
              <div
                role="menu"
                className="absolute right-0 top-full z-30 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/70"
              >
                <p className={menuSectionClass}>Quick actions</p>
                <button role="menuitem" type="button" onClick={() => runMoreAction(() => onSelectRows(selectableRows.filter((row) => !row.selected).map((row) => row.row_number)))} className={menuItemClass} title="Invert which preview rows are included">
                  <RotateCcw className="size-3.5" /> Invert selection
                </button>
                <button role="menuitem" type="button" onClick={() => runMoreAction(() => onIgnoreRows(selectedRows))} disabled={!selectedRows.length} className={menuItemClass} title="Move the currently selected rows to excluded rows so validation skips them">
                  <Ban className="size-3.5" /> Exclude selected
                </button>
                <button role="menuitem" type="button" onClick={() => runMoreAction(() => onMarkDataRows(selectedRows))} disabled={!selectedRows.length} className={menuItemClass} title="Move selected rows back into included data rows">
                  <CheckSquare className="size-3.5" /> Include selected
                </button>
                <button role="menuitem" type="button" onClick={() => runMoreAction(() => onIgnoreRows(selectedRowWarnings.map((warning) => warning.rowNumber)))} disabled={!selectedRowWarnings.length} className={menuItemClass} title="Exclude selected rows that look blank, header-like, summary-like, or non-data">
                  <AlertTriangle className="size-3.5" /> Exclude review rows
                </button>
                <div className="my-1 h-px bg-slate-100" />
                <p className={menuSectionClass}>Select row range</p>
                <form className="px-3 py-2" onSubmit={handleSelectRange} title="Select preview rows by Excel row number range. These numbers come from the Excel row column in the table." aria-label="Select range by Excel row numbers">
                  <div className="flex items-center gap-2">
                    <label className="sr-only" htmlFor={rowRangeStartId}>Start Excel row</label>
                    <input
                      id={rowRangeStartId}
                      type="number"
                      min={1}
                      inputMode="numeric"
                      placeholder="Start"
                      value={rangeStart}
                      onChange={(event) => {
                        setRangeStart(event.target.value);
                        setRangeError("");
                      }}
                      className={rangeInputClass}
                      title="Starting Excel row number, based on the Excel row column"
                    />
                    <span className="text-slate-400">–</span>
                    <label className="sr-only" htmlFor={rowRangeEndId}>End Excel row</label>
                    <input
                      id={rowRangeEndId}
                      type="number"
                      min={1}
                      inputMode="numeric"
                      placeholder="End"
                      value={rangeEnd}
                      onChange={(event) => {
                        setRangeEnd(event.target.value);
                        setRangeError("");
                      }}
                      className={rangeInputClass}
                      title="Ending Excel row number, based on the Excel row column"
                    />
                    <button
                      type="submit"
                      className="inline-flex h-8 items-center rounded-lg bg-emerald-700 px-3 text-xs font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"
                      title="Select all preview rows between the entered Excel row numbers"
                      aria-label="Select Excel row range"
                    >
                      Select
                    </button>
                  </div>
                  {rangeError ? <p className="mt-2 rounded-lg bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700" role="alert">{rangeError}</p> : null}
                </form>
                <div className="my-1 h-px bg-slate-100" />
                <p className={menuSectionClass}>Clean rows</p>
                <button role="menuitem" type="button" onClick={() => runMoreAction(() => onIgnoreRows(blankRows))} disabled={!blankRows.length} className={menuItemClass} title="Exclude blank preview rows so they are skipped during validation">
                  Exclude blank rows
                </button>
                <button role="menuitem" type="button" onClick={() => runMoreAction(() => onIgnoreRows(rowsMatchingSummaryTerm(selectableRows, "total")))} className={menuItemClass} title="Exclude rows where total appears like a summary label, not just inside notes">
                  Exclude total summary rows
                </button>
                <button role="menuitem" type="button" onClick={() => runMoreAction(() => onIgnoreRows(rowsMatchingSummaryTerm(selectableRows, "subtotal")))} className={menuItemClass} title="Exclude rows where subtotal appears like a summary label">
                  Exclude subtotal rows
                </button>
                <button role="menuitem" type="button" onClick={() => runMoreAction(() => onIgnoreRows(rowsMatchingSummaryTerm(selectableRows, "grand total")))} className={menuItemClass} title="Exclude rows where grand total appears like a summary label">
                  Exclude grand total rows
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {selectedRowWarnings.length ? (
        <div className="border-b border-amber-200 bg-amber-50/90 px-3 py-1.5 text-xs text-amber-900" role="status">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 font-semibold">
              <AlertTriangle className="size-3.5 shrink-0" /> {rowWarningSummary(selectedRowWarnings)}
            </span>
            {selectedRowWarnings.slice(0, 3).map((warning) => (
              <span key={warning.rowNumber} className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-amber-900 ring-1 ring-amber-200">
                Row {warning.rowNumber}: {warning.reason}
              </span>
            ))}
            <span className="text-[11px] font-medium text-amber-700">Warning only — you may continue if these rows are correct.</span>
          </div>
        </div>
      ) : null}

      <div className="relative max-h-[520px] overflow-auto rounded-b-2xl bg-white">
        <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-[13px] leading-5">
          <thead className="sticky top-0 z-10 bg-slate-50 text-[12px] font-bold text-slate-700">
            <tr>
              <th className="w-12 border-b border-slate-200 p-2.5 text-center">Use</th>
              <th className="w-24 border-b border-slate-200 p-2.5">Excel row</th>
              <th className="w-28 border-b border-slate-200 p-2.5">Status</th>
              {headers.map((header) => <th key={header} className="max-w-64 border-b border-slate-200 p-2.5">{header}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const status = rowStatus(row, headers, headerRowNumber);
              const locked = lockedRows.has(row.row_number);
              const isHeaderRow = row.row_number === headerRowNumber;
              const needsReview = warningRowSet.has(row.row_number);
              return (
                <tr
                  key={row.row_number}
                  tabIndex={locked ? -1 : 0}
                  role={locked ? undefined : "button"}
                  aria-disabled={locked || undefined}
                  aria-label={isHeaderRow ? `Excel row ${row.row_number} is the header row` : locked ? `Excel row ${row.row_number} is excluded by row setup` : `${row.selected ? "Unselect" : "Select"} Excel row ${row.row_number}`}
                  title={isHeaderRow ? "This row is the header row and is not selectable." : locked ? "This row is excluded by the first data row setting." : needsReview ? "This selected row may not be real data. Review it, or continue if it is correct." : "Click to toggle this row"}
                  onClick={() => {
                    if (!locked) onToggleRow(row.row_number);
                  }}
                  onKeyDown={(event) => handleRowKeyDown(event, row.row_number)}
                  className={`group border-t border-slate-100 align-middle transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-emerald-600 ${locked ? "cursor-not-allowed" : "cursor-pointer hover:bg-slate-50"} ${needsReview ? "bg-amber-50/70" : isHeaderRow ? "bg-sky-50/80" : row.selected ? "bg-emerald-50/35" : ""} ${locked && !isHeaderRow ? "opacity-80" : ""} ${row.ignored && !row.selected && !locked ? "opacity-80" : ""}`}
                >
                  <td className="border-b border-slate-100 p-0 align-middle">
                    <div className="flex min-h-11 items-center justify-center px-2.5 py-2">
                      <input
                        type="checkbox"
                        aria-label={`${row.selected ? "Unselect" : "Select"} Excel row ${row.row_number}`}
                        checked={row.selected}
                        disabled={locked}
                        onClick={(event) => event.stopPropagation()}
                        onChange={() => onToggleRow(row.row_number)}
                        className="size-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </div>
                  </td>
                  <td className={`${rowCellClass} font-bold text-slate-800`}>{row.row_number}</td>
                  <td className="border-b border-slate-100 p-2.5 align-middle">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ${status.className}`}>{status.label}</span>
                  </td>
                  {headers.map((header) => (
                    <td key={`${row.row_number}-${header}`} className={`${rowCellClass} max-w-64 truncate`} title={String(row.cells[header] ?? "")}>
                      {String(row.cells[header] ?? "")}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
