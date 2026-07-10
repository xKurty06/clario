import type { ColumnReference } from "../../types/validation.types";

interface ColumnPickerProps {
  columns: ColumnReference[];
  value: string;
  onChange: (value: string) => void;
}

export function ColumnPicker({ columns, value, onChange }: ColumnPickerProps) {
  return (
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
  );
}
