import { Ban, CheckSquare, RotateCcw, Square, Table2 } from "lucide-react";
import type { KeyboardEvent } from "react";
import type { PreviewRow } from "../../types/validation.types";

interface RowSelectionTableProps {
  headers: string[];
  rows: PreviewRow[];
  onToggleRow: (rowNumber: number) => void;
  onSelectRows: (rowNumbers: number[]) => void;
  onIgnoreRows: (rowNumbers: number[]) => void;
  onMarkDataRows: (rowNumbers: number[]) => void;
}

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

  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, rowNumber: number) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onToggleRow(rowNumber);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white p-3 text-xs font-semibold text-slate-700">
        <button title="Select all rows in this preview" aria-label="Select all rows in this preview" onClick={() => onSelectRows(visibleRows)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600">
          <CheckSquare className="size-3.5" /> Select all
        </button>
        <button title="Clear the current row selection" aria-label="Clear the current row selection" onClick={() => onSelectRows([])} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600">
          <Square className="size-3.5" /> Select none
        </button>
        <button title="Invert which preview rows are selected" aria-label="Invert which preview rows are selected" onClick={() => onSelectRows(rows.filter((row) => !row.selected).map((row) => row.row_number))} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600">
          <RotateCcw className="size-3.5" /> Invert
        </button>
        <button title="Select the rows shown in this preview table" aria-label="Select the rows shown in this preview table" onClick={() => onSelectRows(visibleRows)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600">
          <Table2 className="size-3.5" /> Select visible
        </button>
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <button title="Ignore blank preview rows so they are skipped during validation" aria-label="Exclude blank rows from validation" onClick={() => onIgnoreRows(blankRows)} className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600">Exclude blank rows</button>
        <button title="Ignore rows containing the word total" aria-label="Exclude total rows from validation" onClick={() => onIgnoreRows(rowsContaining("total"))} className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600">Exclude total rows</button>
        <button title="Ignore rows containing the word subtotal" aria-label="Exclude subtotal rows from validation" onClick={() => onIgnoreRows(rowsContaining("subtotal"))} className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600">Exclude subtotal rows</button>
        <button title="Ignore rows containing the phrase grand total" aria-label="Exclude grand total rows from validation" onClick={() => onIgnoreRows(rowsContaining("grand total"))} className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600">Exclude grand total rows</button>
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <button title="Mark the selected preview rows as ignored" aria-label="Mark selected rows as ignored" onClick={() => onIgnoreRows(selectedRows)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600">
          <Ban className="size-3.5" /> Mark selected as ignored
        </button>
        <button title="Mark the selected preview rows as data rows" aria-label="Mark selected rows as data" onClick={() => onMarkDataRows(selectedRows)} className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600">Mark selected as data</button>
      </div>
      <div className="max-h-[520px] overflow-auto">
        <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-xs">
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
                  title="Click anywhere on this row to select or unselect it"
                  onClick={() => onToggleRow(row.row_number)}
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
