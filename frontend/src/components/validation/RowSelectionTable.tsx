import { AlertTriangle, Ban, CheckSquare, ChevronDown, MoreHorizontal, RotateCcw, Square, Table2 } from "lucide-react";
import { useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
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

const toolbarButtonClass = "inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50";
const rangeInputClass = "h-6 w-14 rounded-md border border-slate-200 bg-white px-1.5 text-center text-xs font-semibold text-slate-800 outline-none placeholder:font-medium placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";
const menuItemClass = "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus:bg-slate-50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50";
const menuSectionClass = "px-3 pt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400";
const nonDataTerms = ["grand total", "subtotal", "total", "signature", "prepared by", "approved by", "certified", "noted by", "lot", "section", "category"];

function rowValues(row: PreviewRow) {
  return Object.values(row.cells).map((value) => String(value ?? "").trim());
}

function rowText(row: PreviewRow) {
  return rowValues(row).join(" ").trim();
}

function meaningfulValues(row: PreviewRow) {
  return rowValues(row).filter(Boolean);
}

function rowWarning(row: PreviewRow, headers: string[], headerRowNumber?: number): string | null {
  if (!row.selected) return null;
  const text = rowText(row).toLowerCase();
  const values = meaningfulValues(row);
  const nonEmptyRatio = values.length / Math.max(1, Object.keys(row.cells).length);
  if (row.row_number === headerRowNumber) return "selected header row";
  if (!text) return "blank selected row";
  if (values.length <= 1 || nonEmptyRatio < 0.25) return "mostly empty selected row";
  const matchedTerm = nonDataTerms.find((term) => text.includes(term));
  if (matchedTerm) return `contains “${matchedTerm}”`;
  const headerHits = headers.filter((header) => header && text.includes(header.toLowerCase())).length;
  if (headers.length > 1 && headerHits >= Math.min(2, headers.length)) return "looks like a header/title row";
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
  const headerHits = headers.filter((header) => header && text.toLowerCase().includes(header.toLowerCase())).length;
  if (headerHits >= Math.min(2, headers.length)) return { label: "Header-like", className: "bg-amber-50 text-amber-700" };
  return { label: "Not included", className: "bg-slate-50 text-slate-500" };
}

function rowsContaining(rows: PreviewRow[], term: string) {
  return rows.filter((row) => rowText(row).toLowerCase().includes(term)).map((row) => row.row_number);
}

function rowWarningSummary(warnings: RowWarning[]) {
  if (!warnings.length) return "";
  const rows = warnings.slice(0, 5).map((warning) => `Row ${warning.rowNumber}`).join(", ");
  const extra = warnings.length > 5 ? ` and ${warnings.length - 5} more` : "";
  return `${rows}${extra} should be reviewed before validation.`;
}

export function RowSelectionTable({ headers, rows, lockedRowNumbers = [], headerRowNumber, onToggleRow, onSelectRows, onIgnoreRows, onMarkDataRows }: RowSelectionTableProps) {
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
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 rounded-t-2xl border-b border-slate-200 bg-white p-3 text-xs font-semibold text-slate-700">
        <button type="button" title="Include all rows in this preview" aria-label="Include all rows in this preview" onClick={() => onSelectRows(selectableRowNumbers)} className={toolbarButtonClass}>
          <CheckSquare className="size-3.5" /> Select all
        </button>
        <button type="button" title="Clear the current row selection" aria-label="Clear the current row selection" onClick={() => onSelectRows([])} className={toolbarButtonClass}>
          <Square className="size-3.5" /> Select none
        </button>
        <button type="button" title="Invert which preview rows are included" aria-label="Invert which preview rows are included" onClick={() => onSelectRows(selectableRows.filter((row) => !row.selected).map((row) => row.row_number))} className={toolbarButtonClass}>
          <RotateCcw className="size-3.5" /> Invert
        </button>
        <form
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100"
          onSubmit={handleSelectRange}
          title="Select preview rows by Excel row number range. These numbers come from the Excel row column in the table."
          aria-label="Select range by Excel row numbers"
        >
          <span className="whitespace-nowrap">Select range</span>
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold leading-4 text-slate-500" title="The start and end values use the Excel row numbers shown in the Excel row column.">
            Excel row
          </span>
          <label className="sr-only" htmlFor="row-range-start">Start Excel row</label>
          <input
            id="row-range-start"
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
          <label className="sr-only" htmlFor="row-range-end">End Excel row</label>
          <input
            id="row-range-end"
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
            className="inline-flex h-6 items-center rounded-md bg-emerald-700 px-2 text-[11px] font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"
            title="Select all preview rows between the entered Excel row numbers"
            aria-label="Select Excel row range"
          >
            Select
          </button>
        </form>
        {rangeError ? <span className="rounded-lg bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700" role="alert">{rangeError}</span> : null}
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <div className="relative">
          <button
            type="button"
            title="Open extra row cleanup and include/exclude actions"
            aria-label="Open more row actions"
            aria-haspopup="menu"
            aria-expanded={moreActionsOpen}
            onClick={() => setMoreActionsOpen((open) => !open)}
            className={toolbarButtonClass}
          >
            <MoreHorizontal className="size-3.5" /> More row actions <ChevronDown className={`size-3.5 transition ${moreActionsOpen ? "rotate-180" : ""}`} />
          </button>
          {moreActionsOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-full z-30 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/70"
            >
              <p className={menuSectionClass}>Selection</p>
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
              <p className={menuSectionClass}>Clean rows</p>
              <button role="menuitem" type="button" onClick={() => runMoreAction(() => onIgnoreRows(blankRows))} disabled={!blankRows.length} className={menuItemClass} title="Exclude blank preview rows so they are skipped during validation">
                Exclude blank rows
              </button>
              <button role="menuitem" type="button" onClick={() => runMoreAction(() => onIgnoreRows(rowsContaining(selectableRows, "total")))} className={menuItemClass} title="Exclude rows containing the word total">
                Exclude rows containing total
              </button>
              <button role="menuitem" type="button" onClick={() => runMoreAction(() => onIgnoreRows(rowsContaining(selectableRows, "subtotal")))} className={menuItemClass} title="Exclude rows containing the word subtotal">
                Exclude rows containing subtotal
              </button>
              <button role="menuitem" type="button" onClick={() => runMoreAction(() => onIgnoreRows(rowsContaining(selectableRows, "grand total")))} className={menuItemClass} title="Exclude rows containing the phrase grand total">
                Exclude rows containing grand total
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {selectedRowWarnings.length ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
          <div className="flex gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-semibold">Review selected rows that may not be real data.</p>
              <p className="mt-1 text-xs leading-5 text-amber-800">{rowWarningSummary(selectedRowWarnings)}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selectedRowWarnings.slice(0, 6).map((warning) => (
                  <span key={warning.rowNumber} className="rounded-full bg-white/75 px-2 py-1 text-[11px] font-semibold text-amber-900 ring-1 ring-amber-200">
                    Row {warning.rowNumber}: {warning.reason}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="relative max-h-[520px] overflow-auto rounded-b-2xl bg-white">
        <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-xs">
          <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600">
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
                  title={isHeaderRow ? "This row is the header row and is not selectable." : locked ? "This row is excluded by the first data row setting." : needsReview ? "This selected row may not be real data. Review or exclude it before validation." : "Click to toggle this row"}
                  onClick={() => {
                    if (!locked) onToggleRow(row.row_number);
                  }}
                  onKeyDown={(event) => handleRowKeyDown(event, row.row_number)}
                  className={`group border-t border-slate-100 align-middle transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-emerald-600 ${locked ? "cursor-not-allowed" : "cursor-pointer hover:bg-slate-50"} ${needsReview ? "bg-amber-50/70" : isHeaderRow ? "bg-sky-50/80" : row.selected ? "bg-emerald-50/50" : ""} ${locked && !isHeaderRow ? "opacity-60" : ""} ${row.ignored && !row.selected && !locked ? "opacity-60" : ""}`}
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
                  <td className="border-b border-slate-100 p-2.5 align-middle font-semibold text-slate-700">{row.row_number}</td>
                  <td className="border-b border-slate-100 p-2.5 align-middle">
                    <span className={`inline-flex rounded-full px-2 py-1 font-semibold ${status.className}`}>{status.label}</span>
                  </td>
                  {headers.map((header) => (
                    <td key={`${row.row_number}-${header}`} className="max-w-64 truncate border-b border-slate-100 p-2.5 align-middle text-slate-700" title={String(row.cells[header] ?? "")}>
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
