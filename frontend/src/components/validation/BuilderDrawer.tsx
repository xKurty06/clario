import { X } from "lucide-react";
import type { ReactNode } from "react";

interface BuilderDrawerProps {
  title: string;
  description?: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function BuilderDrawer({ title, description, open, onClose, children, footer }: BuilderDrawerProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <button className="absolute inset-0 bg-slate-950/30" aria-label="Close drawer" onClick={onClose} />
      <aside className="absolute bottom-0 right-0 top-0 flex w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
            {description ? <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p> : null}
          </div>
          <button className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer ? <footer className="border-t border-slate-200 p-5">{footer}</footer> : null}
      </aside>
    </div>
  );
}
