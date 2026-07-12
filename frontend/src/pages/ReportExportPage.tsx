import { Download, FileOutput } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "../components/common/EmptyState";
import { PageHeader } from "../components/layout/PageHeader";
import { useWorkflow } from "../features/files/WorkflowContext";
import { exportPdf } from "../services/reportApi";

export function ReportExportPage() {
  const { result } = useWorkflow();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  if (!result) {
    return (
      <div>
        <PageHeader eyebrow="Step 4 of 4" title="Export local report" description="Run validation first, then return here to export the completed result." />
        <div className="pt-8">
          <EmptyState
            icon={FileOutput}
            title="No report data"
            description="A completed validation result is required for PDF export. If you already ran validation in this browser session, return to Results. Otherwise, go back to Review & Run and run validation again."
          />
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link to="/results" className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Back to Results
            </Link>
            <Link to="/mapping" className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Return to Review & Run
            </Link>
            <Link to="/upload" className="inline-flex items-center justify-center rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">
              Start new validation
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const download = async () => {
    setBusy(true);
    setMessage("");
    try {
      const blob = await exportPdf(result);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${result.project_name.replace(/[^a-z0-9]+/gi, "-")}-comparison-report.pdf`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("PDF report created from the completed validation result. Validation was not re-run.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not create report.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Step 4 of 4"
        title="Export local report"
        description="Create a formal PDF summary of the selected data sources, extracted fields, comparison rules, and detailed discrepancies. Export uses the completed result only."
      />
      <section className="mt-8 max-w-3xl rounded-2xl border border-slate-200 bg-white p-6">
        <FileOutput className="size-7 text-emerald-700" />
        <h2 className="mt-4 text-lg font-semibold">{result.project_name}</h2>
        <dl className="mt-5 grid grid-cols-4 gap-4 border-y border-slate-200 py-5">
          <div><dt className="text-xs text-slate-500">Selected rows</dt><dd className="mt-1 font-semibold">{result.total_selected_rows}</dd></div>
          <div><dt className="text-xs text-slate-500">Data sources</dt><dd className="mt-1 font-semibold">{result.data_sources.length}</dd></div>
          <div><dt className="text-xs text-slate-500">Rules</dt><dd className="mt-1 font-semibold">{result.rule_summaries.length}</dd></div>
          <div><dt className="text-xs text-slate-500">Discrepancies</dt><dd className="mt-1 font-semibold">{result.discrepancies.length}</dd></div>
        </dl>
        <button disabled={busy} onClick={download} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          <Download className="size-4" />
          {busy ? "Creating report..." : "Export PDF report"}
        </button>
        {message && <p className="mt-4 text-sm text-slate-600" role="status">{message}</p>}
      </section>
    </div>
  );
}
