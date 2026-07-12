import { Download, ExternalLink, FileOutput } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "../components/common/EmptyState";
import { PageHeader } from "../components/layout/PageHeader";
import { useWorkflow } from "../features/files/WorkflowContext";
import { exportPdf } from "../services/reportApi";

interface ExportedReportState {
  url: string;
  filename: string;
  savedPath: string | null;
}

export function ReportExportPage() {
  const { result } = useWorkflow();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error" | "neutral">("neutral");
  const [exportedReport, setExportedReport] = useState<ExportedReportState | null>(null);

  useEffect(() => {
    return () => {
      if (exportedReport?.url) URL.revokeObjectURL(exportedReport.url);
    };
  }, [exportedReport?.url]);

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
    setMessageTone("neutral");
    try {
      const report = await exportPdf(result);
      if (!report.blob.size) {
        throw new Error("The PDF service returned an empty report. Please run validation again and retry export.");
      }

      const url = URL.createObjectURL(report.blob);
      setExportedReport((current) => {
        if (current?.url) URL.revokeObjectURL(current.url);
        return { url, filename: report.filename, savedPath: report.savedPath };
      });

      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = report.filename;
      anchor.rel = "noopener";
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      setMessageTone("success");
      setMessage("PDF report created. The generated report link and saved local path are shown below.");
    } catch (cause) {
      setMessageTone("error");
      setMessage(cause instanceof Error ? cause.message : "Could not create report.");
    } finally {
      setBusy(false);
    }
  };

  const messageClass =
    messageTone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : messageTone === "error"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-slate-200 bg-slate-50 text-slate-600";

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
        <dl className="mt-5 grid grid-cols-2 gap-4 border-y border-slate-200 py-5 sm:grid-cols-4">
          <div><dt className="text-xs text-slate-500">Selected rows</dt><dd className="mt-1 font-semibold">{result.total_selected_rows}</dd></div>
          <div><dt className="text-xs text-slate-500">Data sources</dt><dd className="mt-1 font-semibold">{result.data_sources.length}</dd></div>
          <div><dt className="text-xs text-slate-500">Rules</dt><dd className="mt-1 font-semibold">{result.rule_summaries.length}</dd></div>
          <div><dt className="text-xs text-slate-500">Discrepancies</dt><dd className="mt-1 font-semibold">{result.discrepancies.length}</dd></div>
        </dl>
        <button disabled={busy} onClick={download} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
          <Download className="size-4" />
          {busy ? "Creating report..." : "Export PDF report"}
        </button>
        {message && <p className={`mt-4 rounded-2xl border px-3 py-2.5 text-sm ${messageClass}`} role="status">{message}</p>}

        {exportedReport ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Generated report</p>
            <p className="mt-1 break-all text-sm text-slate-600">{exportedReport.filename}</p>
            {exportedReport.savedPath ? (
              <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Saved local copy</p>
                <p className="mt-1 break-all font-mono text-xs leading-5 text-slate-700">{exportedReport.savedPath}</p>
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={exportedReport.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                <ExternalLink className="size-4" /> Open PDF
              </a>
              <a href={exportedReport.url} download={exportedReport.filename} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">
                <Download className="size-4" /> Download again
              </a>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
