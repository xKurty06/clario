import { useMemo } from "react";
import { useWorkflow } from "../../features/files/WorkflowContext";
import type { ColumnReference, DataSourcePreview, PreviewRow } from "../../types/validation.types";

interface ColumnPickerProps {
  columns: ColumnReference[];
  value: string;
  onChange: (value: string) => void;
}

function cellValue(row: PreviewRow, column: ColumnReference) {
  const value = row.cells[column.header_label] ?? row.cells[column.letter] ?? null;
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function sameColumns(left: ColumnReference[], right: ColumnReference[]) {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  return left.every((column, index) => {
    const other = right[index];
    return other?.letter === column.letter && other.header_label === column.header_label;
  });
}

function findMatchingPreview(columns: ColumnReference[], previews: Record<string, DataSourcePreview | undefined>) {
  return Object.values(previews).find((preview) => preview && sameColumns(preview.columns, columns));
}

function sampleValuesForColumn(preview: DataSourcePreview | undefined, column: ColumnReference | undefined) {
  if (!preview || !column) return [];
  const selectedRows = preview.rows.filter((row) => row.selected && !row.ignored);
  const rows = selectedRows.length ? selectedRows : preview.rows.filter((row) => !row.ignored);
  const seen = new Set<string>();

  return rows
    .map((row) => cellValue(row, column))
    .filter((value) => value && value !== "-" && value !== "—")
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 4);
}

export function ColumnPicker({ columns, value, onChange }: ColumnPickerProps) {
  const { sourcePreviews } = useWorkflow();
  const selectedColumn = columns.find((column) => column.letter === value) ?? columns[0];
  const preview = useMemo(() => findMatchingPreview(columns, sourcePreviews), [columns, sourcePreviews]);
  const samples = useMemo(() => sampleValuesForColumn(preview, selectedColumn), [preview, selectedColumn]);

  return (
    <div className="[&+p]:hidden">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-600 focus:ring-3 focus:ring-emerald-100"
      >
        {columns.map((column) => (
          <option key={column.letter} value={column.letter}>
            {column.letter} - {column.header_label?.trim() || "Blank header"}
          </option>
        ))}
      </select>

      {selectedColumn ? (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-700">Sample values</p>
            <p className="text-[11px] text-slate-500">Column {selectedColumn.letter}</p>
          </div>
          {samples.length ? (
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {samples.map((sample, index) => (
                <span key={`${sample}-${index}`} className="block min-w-0 truncate rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700" title={sample}>
                  {sample}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-500">No non-blank sample values found in the current preview.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
