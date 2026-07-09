import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-8 border-b border-slate-200 pb-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
        <p className="mt-2 max-w-[65ch] text-sm leading-6 text-slate-600">{description}</p>
      </div>
      {action}
    </header>
  );
}

