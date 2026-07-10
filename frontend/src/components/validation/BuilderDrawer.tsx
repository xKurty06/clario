import { X, type LucideIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

interface BuilderDrawerProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  open: boolean;
  dirty?: boolean;
  warningMessage?: string;
  children: ReactNode;
  footerContent?: ReactNode;
  onCancel: () => void;
  onDiscard?: () => void;
  onSave?: () => void;
  saveLabel?: string;
  cancelLabel?: string;
  disableSave?: boolean;
}

export function BuilderDrawer({
  title,
  description,
  icon: Icon,
  open,
  dirty = false,
  warningMessage,
  children,
  footerContent,
  onCancel,
  onDiscard,
  onSave,
  saveLabel = "Save changes",
  cancelLabel = "Cancel",
  disableSave = false,
}: BuilderDrawerProps) {
  const [rendered, setRendered] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setRendered(true);
      setClosing(false);
      return undefined;
    }
    if (!rendered) return undefined;
    setClosing(true);
    const timeoutId = window.setTimeout(() => {
      setRendered(false);
      setClosing(false);
    }, 180);
    return () => window.clearTimeout(timeoutId);
  }, [open, rendered]);

  useEffect(() => {
    if (!rendered) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, rendered]);

  if (!rendered) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        className={`absolute inset-0 bg-slate-950/30 backdrop-blur-[2px] ${closing ? "animate-[builder-backdrop-out_180ms_ease_forwards]" : "animate-[builder-backdrop-in_220ms_ease-out_forwards]"}`}
        aria-label="Close drawer"
        onClick={onCancel}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="builder-drawer-title"
        className={`absolute bottom-0 right-0 top-0 flex w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-2xl ${closing ? "animate-[builder-drawer-out_180ms_cubic-bezier(0.4,0,1,1)_forwards]" : "animate-[builder-drawer-in_240ms_cubic-bezier(0.16,1,0.3,1)_forwards]"}`}
      >
        <header className="shrink-0 border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.12),_transparent_48%),linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-start gap-3">
                {Icon ? (
                  <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700">
                    <Icon className="size-4.5" />
                  </span>
                ) : null}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 gap-y-1">
                    <h2 id="builder-drawer-title" className="text-[1.05rem] font-semibold text-slate-950">
                      {title}
                    </h2>
                    {dirty ? <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold leading-5 text-amber-700">Unsaved changes</span> : null}
                  </div>
                  {description ? <p className="mt-1 max-w-[52ch] text-sm leading-6 text-slate-500">{description}</p> : null}
                </div>
              </div>
            </div>
            <button
              className="grid size-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
              onClick={onCancel}
              aria-label="Close drawer"
              title={dirty ? "Close and decide whether to keep or discard your draft changes" : "Close drawer"}
            >
              <X className="size-4" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {warningMessage ? (
            <div
              role="status"
              className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm leading-6 text-amber-800"
            >
              {warningMessage}
            </div>
          ) : null}
          {children}
        </div>

        <footer className="shrink-0 border-t border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
          <div className={`flex flex-col gap-3 sm:flex-row sm:items-center ${footerContent ? "sm:justify-between" : "sm:justify-end"}`}>
            {footerContent ? <div className="min-w-0 text-sm leading-6 text-slate-500">{footerContent}</div> : null}
            <div className="flex shrink-0 flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                title="Close this panel without saving the current draft"
              >
                {cancelLabel}
              </button>
              {dirty && onDiscard ? (
                <button
                  type="button"
                  onClick={onDiscard}
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                  title="Discard your unsaved changes and restore the last saved version"
                >
                  Discard changes
                </button>
              ) : null}
              {onSave ? (
                <button
                  type="button"
                  onClick={onSave}
                  disabled={disableSave}
                  className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                  title={saveLabel}
                >
                  {saveLabel}
                </button>
              ) : null}
            </div>
          </div>
        </footer>
      </aside>
    </div>
  );
}
