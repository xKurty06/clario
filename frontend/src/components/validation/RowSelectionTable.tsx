import { Ban, CheckSquare, RotateCcw, Square, Table2 } from "lucide-react";
import { useEffect, useState, type FormEvent, type KeyboardEvent, type MouseEvent } from "react";
import type { PreviewRow } from "../../types/validation.types";

interface RowSelectionTableProps {
  headers: string[];
  rows: PreviewRow[];
  onToggleRow: (rowNumber: number) => void;
  onSelectRows: (rowNumbers: number[]) => void;
  onIgnoreRows: (rowNumbers: number[]) => void;
  onMarkDataRows: (rowNumbers: number[]) => void;
}

interface DragSelectionState {
  selecting: boolean;
  selectedRows: Set<number>;
}

const toolbarButtonClass = "inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600";
const rangeInputClass = "h-6 w-14 rounded-md border border-slate-200 bg-white px-1.5 text-center text-xs font-semibold text-slate-800 outline-none placeholder:font-medium placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

function rowText(row: PreviewRow) {
  return Object.values(row.cells).map((value) => String(value ?? "")).join(" ").trim();
}

function rowStatus(row: PreviewRow, headers: string[]) {
  const text = rowText(row);
  if (row.ignored) return { label: "Ignored", className: "bg-slate-100 text-slate-600" };
  if (!text) return { label: "Blank", className: "bg-zinc-100 text-zinc-600" };
  const headerHits = headers.filter((header) => header && text.toLowerCase().includes(header.toLowerCase())).length;
  if (headerHits >= Math.min(2, headers.length)) return { label: "Header-like", className: "bg-amber-50 text-amber-700" };
  if (row.selected) return { label: "Selected", className: "bg-emerald-50 text-emerald-700" };
  return { label: "Not selected", className: "bg-slate-50 text-slate-500" };
}

export function RowSelectionTable({ headers, rows, onToggleRow, onSelectRows, onIgnoreRows, onMarkDataRows }: RowSelectionTableProps) {
  const visibleRows = rows.map((row) => row.row_number);
  const selectedRows = rows.filter((row) => row.selected).map((row) => row.row_number);
  const rowsContaining = (term: string) => rows.filter((row) => rowText(row).toLowerCase().includes(term)).map((row) => row.row_number);
  const blankRows = rows.filter((row) => !rowText(row)).map((row) => row.row_number);
  const [dragSelection, setDragSelection] = useState<DragSelectionState | null>(null);
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [rangeError, setRangeError] = useState("");

  useEffect(() => {
    if (!dragSelection) return undefined;
    const endDrag = () => setDragSelection(null);
    window.addEventListener("mouseup", endDrag);
    window.addEventListener("blur", endDrag);
    return () => {
      window.removeEventListener("mouseup", endDrag);
      window.removeEventListener("blur", endDrag);
    };
  }, [dragSelection]);

  const applyDragSelection = (rowNumber: number, selecting: boolean, selectedRowsSet: Set<number>) => {
    const nextSelectedRows = new Set(selectedRowsSet);
    if (selecting) {
      nextSelectedRows.add(rowNumber);
    } else {
      nextSelectedRows.delete(rowNumber);
    }
    onSelectRows([...nextSelectedRows]);
    return nextSelectedRows;
  };

  const handleRowMouseDown = (event: MouseEvent<HTMLTableRowElement>, row: PreviewRow) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const selecting = !row.selected;
    const nextSelectedRows = applyDragSelection(row.row_number, selecting, new Set(selectedRows));
    setDragSelection({ selecting, selectedRows: nextSelectedRows });
  };

  const handleRowMouseEnter = (rowNumber: number) => {
    setDragSelection((current) => {
      if (!current) return current;
      const nextSelectedRows = applyDragSelection(rowNumber, current.selecting, current.selectedRows);
      return { ...current, selectedRows: nextSelectedRows };
    });
  };

  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, rowNumber: number) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onToggleRow(rowNumber);
  };

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
    const rowsInRange = rows.filter((row) => row.row_number >= lower && row.row_number <= upper).map((row) => row.row_number);

    if (!rowsInRange.length) {
      setRangeError(`No preview rows found from Excel row ${lower} to ${upper}.`);
      return;
    }

    onSelectRows([...new Set([...selectedRows, ...rowsInRange])]);
    setRangeError("");
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white p-3 text-xs font-semibold text-slate-700">
        <button title="Select all rows in this preview" aria-label="Select all rows in this preview" onClick={() => onSelectRows(visibleRows)} className={toolbarButtonClass}>
          <CheckSquare className="size-3.5" /> Select all
        </button>
        <button title="Clear the current row selection" aria-label="Clear the current row selection" onClick={() => onSelectRows([])} className={toolbarButtonClass}>
          <Square className="size-3.5" /> Select none
        </button>
        <button title="Invert which preview rows are selected" aria-label="Invert which preview rows are selected" onClick={() => onSelectRows(rows.filter((row) => !row.selected).map((row) => row.row_number))} className={toolbarButtonClass}>
          <RotateCcw className="size-3.5" /> Invert
        </button>
        <button title="Select the rows shown in this preview table" aria-label="Select the rows shown in this preview table" onClick={() => onSelectRows(visibleRows)} className={toolbarButtonClass}>
          <Table2 className="size-3.5" /> Select visible
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
        <button title="Ignore blank preview rows so they are skipped during validation" aria-label="Exclude blank rows from validation" onClick={() => onIgnoreRows(blankRows)} className={toolbarButtonClass}>Exclude blank rows</button>
        <button title="Ignore rows containing the word total" aria-label="Exclude total rows from validation" onClick={() => onIgnoreRows(rowsContaining("total"))} className={toolbarButtonClass}>Exclude total rows</button>
        <button title="Ignore rows containing the word subtotal" aria-label="Exclude subtotal rows from validation" onClick={() => onIgnoreRows(rowsContaining("subtotal"))} className={toolbarButtonClass}>Exclude subtotal rows</button>
        <button title="Ignore rows containing the phrase grand total" aria-label="Exclude grand total rows from validation" onClick={() => onIgnoreRows(rowsContaining("grand total"))} className={toolbarButtonClass}>Exclude grand total rows</button>
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <button title="Mark the selected preview rows as ignored" aria-label="Mark selected rows as ignored" onClick={() => onIgnoreRows(selectedRows)} className={toolbarButtonClass}>
          <Ban className="size-3.5" /> Mark selected as ignored
        </button>
        <button title="Mark the selected preview rows as data rows" aria-label="Mark selected rows as data" onClick={() => onMarkDataRows(selectedRows)} className={toolbarButtonClass}>Mark selected as data</button>
      </div>
      <div className="max-h-[520px] overflow-auto">
        <table className={`w-full min-w-[760px] border-separate border-spacing-0 text-left text-xs ${dragSelection ? "select-none" : ""}`}>
          <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600">
            <tr>
              <th className="w-12 border-b border-slate-200 p-2.5 text-center">Use</th>
              <th className="w-24 border-b border-slate-200 p-2.5">Excel row</th>
              <th className="w-28 border-b border-slate-200 p-2.5">Status</th>
              {headers.map((header) => <th key={header} className="max-w-64 border-b border-slate-200 p-2.5">{header || "Blank header"}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const status = rowStatus(row, headers);
              return (
                <tr
                  key={row.row_number}
                  tabIndex={0}
                  role="button"
                  aria-label={`${row.selected ? "Unselect" : "Select"} Excel row ${row.row_number}`}
                  title="Click or drag across rows to select or unselect them"
                  onMouseDown={(event) => handleRowMouseDown(event, row)}
                  onMouseEnter={() => handleRowMouseEnter(row.row_number)}
                  onKeyDown={(event) => handleRowKeyDown(event, row.row_number)}
                  className={`group cursor-pointer border-t border-slate-100 align-middle transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-emerald-600 ${row.selected ? "bg-emerald-50/50" : ""} ${row.ignored ? "opacity-60" : ""}`}
                >
                  <td className="border-b border-slate-100 p-0 align-middle">
                    <div className="flex min-h-11 items-center justify-center px-2.5 py-2">
                      <input
                        type="checkbox"
                        aria-label={`${row.selected ? "Unselect" : "Select"} Excel row ${row.row_number}`}
                        checked={row.selected}
                        onClick={(event) => event.stopPropagation()}
                        onMouseDown={(event) => event.stopPropagation()}
                        onChange={() => onToggleRow(row.row_number)}
                        className="size-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
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
