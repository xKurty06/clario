import type { PreviewRow } from "../../types/validation.types";

interface RowSelectionTableProps {
  headers: string[];
  rows: PreviewRow[];
  onToggleRow: (rowNumber: number) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  onInvert: () => void;
}

export function RowSelectionTable({ headers, rows, onToggleRow, onSelectAll, onSelectNone, onInvert }: RowSelectionTableProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 p-3 text-xs font-semibold text-slate-700">
        <button onClick={onSelectAll} className="rounded-lg border border-slate-300 px-3 py-1.5">Select all</button>
        <button onClick={onSelectNone} className="rounded-lg border border-slate-300 px-3 py-1.5">Select none</button>
        <button onClick={onInvert} className="rounded-lg border border-slate-300 px-3 py-1.5">Invert</button>
      </div>
      <div className="max-h-80 overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-slate-100 text-slate-600">
            <tr>
              <th className="p-3">Use</th>
              <th className="p-3">Excel row</th>
              {headers.map((header) => <th key={header} className="p-3">{header}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.row_number} className={`border-t border-slate-100 align-top ${row.selected ? "bg-emerald-50/40" : ""}`}>
                <td className="p-3">
                  <input type="checkbox" checked={row.selected} onChange={() => onToggleRow(row.row_number)} />
                </td>
                <td className="p-3 font-semibold text-slate-700">{row.row_number}</td>
                {headers.map((header) => (
                  <td key={`${row.row_number}-${header}`} className="max-w-60 p-3 text-slate-700">
                    {String(row.cells[header] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
