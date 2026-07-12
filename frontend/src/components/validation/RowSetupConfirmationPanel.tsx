import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, FileSpreadsheet, Rows3, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import type { ComparisonDataSource, DataSourcePreview } from "../../types/validation.types";

interface RowSetupConfirmationPanelProps {
  dataSources: ComparisonDataSource[];
  sourcePreviews: Record<string, DataSourcePreview>;
  onConfirmSource: (sourceId: string) => void;
  onConfirmAll: () => void;
}

function rowSetupStatus(source: ComparisonDataSource, preview?: DataSourcePreview) {
  if (!preview) {
    return {
      tone: "warning" as const,
      label: "Preview needed",
      detail: "Load a row preview before confirming the detected header and data rows.",
    };
  }

  if (source.row_setup_confirmed) {
    return {
      tone: "success" as const,
      label: "Confirmed",
      detail: "Header row and first data row have been reviewed.",
    };
  }

  return {
    tone: "warning" as const,
    label: "Needs confirmation",
    detail: "Review the detected rows before running validation.",
  };
}

export function RowSetupConfirmationPanel({ dataSources, sourcePreviews, onConfirmSource, onConfirmAll }: RowSetupConfirmationPanelProps) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const visible = location.pathname.startsWith("/mapping") && dataSources.length > 0;

  const sources = useMemo(
    () => dataSources.map((source) => ({ source, preview: sourcePreviews[source.id], status: rowSetupStatus(source, sourcePreviews[source.id]) })),
    [dataSources, sourcePreviews],
  );
  const unconfirmed = sources.filter(({ source }) => !source.row_setup_confirmed);
  const confirmable = unconfirmed.filter(({ preview }) => Boolean(preview));
  const blocked = visible && unconfirmed.length > 0;

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    if (blocked) {
      document.body.dataset.rowSetupBlocked = "true";
    } else {
      delete document.body.dataset.rowSetupBlocked;
    }
    return () => {
      delete document.body.dataset.rowSetupBlocked;
    };
  }, [blocked]);

  if (!visible || !unconfirmed.length) return null;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="fixed bottom-5 right-5 z-[50] inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm font-semibold text-amber-800 shadow-xl transition hover:-translate-y-0.5 hover:border-amber-300 hover:bg-amber-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
      >
        <AlertTriangle className="size-4" />
        {unconfirmed.length} row setup {unconfirmed.length === 1 ? "needs" : "need"} confirmation
        <ChevronUp className="size-4" />
      </button>
    );
  }

  return (
    <aside className="fixed bottom-5 right-5 z-[50] w-[min(440px,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-amber-200 bg-white shadow-2xl animate-[builder-dialog-in_180ms_cubic-bezier(0.16,1,0.3,1)_forwards]">
      <div className="border-b border-amber-100 bg-[linear-gradient(135deg,_#fffbeb_0%,_#ffffff_100%)] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-700">
              <ShieldCheck className="size-5" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-950">Confirm row setup</h2>
              <p className="mt-1 text-sm leading-5 text-slate-600">
                Auto-detected header and data rows must be reviewed before validation.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            aria-label="Collapse row setup confirmation"
            className="grid size-9 shrink-0 place-items-center rounded-xl text-slate-500 transition hover:bg-white hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
          >
            <ChevronDown className="size-4" />
          </button>
        </div>
      </div>

      <div className="max-h-[min(52vh,420px)] space-y-3 overflow-y-auto p-4">
        {sources.map(({ source, preview, status }) => {
          const confirmed = status.tone === "success";
          return (
            <article key={source.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl ${confirmed ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                  {confirmed ? <CheckCircle2 className="size-4" /> : <Rows3 className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-950">{source.name}</p>
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${confirmed ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                      {status.label}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{status.detail}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Header row</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{source.header_row}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">First data row</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{source.first_data_row}</p>
                    </div>
                  </div>
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                    <FileSpreadsheet className="size-3.5" />
                    {source.sheet_name || "No sheet selected"}
                  </p>
                </div>
              </div>
              {!source.row_setup_confirmed ? (
                <button
                  type="button"
                  disabled={!preview}
                  onClick={() => onConfirmSource(source.id)}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <CheckCircle2 className="size-4" />
                  Confirm this row setup
                </button>
              ) : null}
            </article>
          );
        })}
      </div>

      <div className="border-t border-slate-200 bg-slate-50 p-4">
        <button
          type="button"
          disabled={!confirmable.length}
          onClick={onConfirmAll}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CheckCircle2 className="size-4" />
          Confirm all previewed sources
        </button>
        <p className="mt-2 text-center text-xs leading-5 text-slate-500">
          Change the file, sheet, header row, or first data row to reset confirmation.
        </p>
      </div>
    </aside>
  );
}
