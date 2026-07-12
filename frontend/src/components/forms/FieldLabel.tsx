import type { ReactNode } from "react";

interface FieldLabelProps {
  children: ReactNode;
  help: string;
  required?: boolean;
  className?: string;
}

export function FieldLabel({ children, help, required = false, className = "text-xs text-slate-600" }: FieldLabelProps) {
  return (
    <span className={`inline-flex items-center gap-1 font-semibold ${className}`} title={help}>
      <span>{children}{required ? " *" : ""}</span>
    </span>
  );
}
