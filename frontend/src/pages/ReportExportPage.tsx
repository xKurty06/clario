import { CheckCircle2, Download, ExternalLink, FileOutput } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "../components/common/EmptyState";
import { PageHeader } from "../components/layout/PageHeader";
import { useWorkflow } from "../features/files/WorkflowContext";
import { exportPdf } from "../services/reportApi";

interface ExportedReportState {
  filename: string;
  savedPath: string | null;
  openUrl: string;
}

const primaryActionClass = "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none disabled:active:scale-100";
const secondaryActionClass = "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600";

function ExportMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 text-xl font-semibold text-slate-950">{value}</dd>
    </div>
  );
}

export function ReportExportPage() {
  const { result } = useWorkflow();
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [exportedReport, setExportedReport] = useState<ExportedReportState | null>(null);

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
            <Link to="/results" className={secondaryActionClass}>
              Back to Results
            </Link>
            <Link to="/mapping" className={secondaryActionClass}>
              Return to Review & Run
            </Link>
            <Link to="/upload" className={primaryActionClass}>
              Start new validation
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const generateReport = async () => {
    setBusy(true);
    setErrorMessage("");
    try {
      const report = await exportPdf(result);
      if (!report.blob.size) {
        throw new Error("The PDF service returned an empty report. Please run validation again and retry export.");
      }

      setExportedReport({
        filename: report.filename,
        savedPath: report.savedPath,
        openUrl: report.openUrl,
      });
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : "Could not create report.");
    } finally {
      setBusy(false);
    }
  };

  const openReport = () => {
    if (!exportedReport) return;
    window.location.assign(exportedReport.openUrl);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Step 4 of 4"
        title="Export local report"
        description="Create a PDF summary from the completed validation result. The report is generated locally and validation will not be re-run."
      />

      <section className="mt-8 max-w-4xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700">
              <FileOutput className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Ready to export</p>
              <h2 className="mt-1 break-words text-xl font-semibold text-slate-950">{result.project_name}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Review the summary below, then generate a local PDF copy of this validation result.
              </p>
            </div>
          </div>
          <button disabled={busy} onClick={generateReport} className={`${primaryActionClass} lg:mt-1`}>
            <Download className="size-4" />
            {busy ? "Creating report..." : exportedReport ? "Regenerate PDF" : "Generate PDF report"}
          </button>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <ExportMetric label="Selected rows" value={result.total_selected_rows} />
          <ExportMetric label="Data sources" value={result.data_sources.length} />
          <ExportMetric label="Rules" value={result.rule_summaries.length} />
          <ExportMetric label="Discrepancies" value={result.discrepancies.length} />
        </dl>

        {errorMessage ? (
          <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700" role="status">
            {errorMessage}
          </p>
        ) : null}

        {exportedReport ? (
          <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50/60 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-emerald-800">
                  <CheckCircle2 className="size-5 shrink-0" />
                  <p className="text-sm font-bold uppercase tracking-[0.14em]">Report ready</p>
                </div>
                <p className="mt-2 break-all text-sm font-semibold text-slate-950">{exportedReport.filename}</p>
                {exportedReport.savedPath ? (
                  <p className="mt-2 break-all font-mono text-xs leading-5 text-slate-600">
                    {exportedReport.savedPath}
                  </p>
                ) : null}
              </div>
              <button type="button" onClick={openReport} className={secondaryActionClass}>
                <ExternalLink className="size-4" /> Open PDF
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-500">
            No PDF has been generated yet for this result. Click <span className="font-semibold text-slate-700">Generate PDF report</span> to create one.
          </div>
        )}
      </section>
    </div>
  );
}
