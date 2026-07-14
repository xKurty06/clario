import { CheckCircle2, Download, ExternalLink, FileOutput, ListChecks } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/layout/PageHeader";
import { useWorkflow } from "../features/files/WorkflowContext";
import { exportPdf, latestReportInfo, openPdfExternally } from "../services/reportApi";

interface ExportedReportState {
  filename: string;
  savedPath: string | null;
}

const primaryActionClass = "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none disabled:active:scale-100";
const secondaryActionClass = "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100";
const reportPanelClass = "mx-auto mt-8 w-full max-w-4xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm";

function reportStorageKey(resultId: string) {
  return `clario:exported-report:${resultId}`;
}

function readStoredReport(resultId: string): ExportedReportState | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.sessionStorage.getItem(reportStorageKey(resultId));
    return value ? (JSON.parse(value) as ExportedReportState) : null;
  } catch {
    return null;
  }
}

function writeStoredReport(resultId: string, report: ExportedReportState) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(reportStorageKey(resultId), JSON.stringify(report));
  } catch {
    // Ignore storage failures. The backend can still return the latest report while the app is open.
  }
}

function ExportMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 text-xl font-semibold text-slate-950">{value}</dd>
    </div>
  );
}

function EmptyReportStep({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700">Step {number}</p>
      <p className="mt-1 text-sm font-semibold text-slate-950">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
    </div>
  );
}

export function ReportExportPage() {
  const { result } = useWorkflow();
  const [busy, setBusy] = useState(false);
  const [openBusy, setOpenBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [exportedReport, setExportedReport] = useState<ExportedReportState | null>(null);

  useEffect(() => {
    if (!result) {
      setExportedReport(null);
      return;
    }

    let active = true;
    const storedReport = readStoredReport(result.id);
    if (storedReport) setExportedReport(storedReport);

    void latestReportInfo(result.id)
      .then((report) => {
        if (!active) return;
        const next = { filename: report.filename, savedPath: report.savedPath };
        setExportedReport(next);
        writeStoredReport(result.id, next);
      })
      .catch(() => {
        if (active && !storedReport) setExportedReport(null);
      });

    return () => {
      active = false;
    };
  }, [result]);

  if (!result) {
    return (
      <div>
        <PageHeader
          eyebrow="Step 4 of 4"
          title="Export local report"
          description="A PDF report can only be generated after validation has finished."
        />

        <section className={reportPanelClass}>
          <div className="flex min-w-0 items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500">
              <FileOutput className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Waiting for validation</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">No completed validation yet</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Finish the builder setup, run validation, then return here to generate the local PDF report.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <EmptyReportStep number={1} title="Finish setup" description="Check sources, rows, fields, and rules in the builder." />
            <EmptyReportStep number={2} title="Run validation" description="Use Review & Run to create the result that the report will use." />
            <EmptyReportStep number={3} title="Export PDF" description="Come back here after validation to generate the local report." />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/mapping" className={primaryActionClass}>
              <ListChecks className="size-4" /> Go to Review & Run
            </Link>
            <Link to="/results" className={secondaryActionClass}>
              Back to Results
            </Link>
            <Link to="/upload" className={secondaryActionClass}>
              Start new validation
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const generateReport = async () => {
    setBusy(true);
    setErrorMessage("");
    setStatusMessage("");
    try {
      const previousPath = exportedReport?.savedPath;
      const report = await exportPdf(result);
      if (!report.blob.size) {
        throw new Error("The PDF service returned an empty report. Please run validation again and retry export.");
      }

      const nextReport = {
        filename: report.filename,
        savedPath: report.savedPath,
      };
      setExportedReport(nextReport);
      writeStoredReport(result.id, nextReport);

      if (previousPath && report.savedPath && previousPath === report.savedPath) {
        setStatusMessage("PDF regenerated, but the backend returned the same saved path. Restart the local backend if the file name does not change after pulling the latest code.");
        return;
      }

      setStatusMessage(exportedReport ? "PDF regenerated locally. Open in PDF viewer will use this latest file." : "PDF generated locally. Use Open in PDF viewer to view it with your default PDF app.");
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : "Could not create report.");
    } finally {
      setBusy(false);
    }
  };

  const openReport = async () => {
    if (!exportedReport) return;
    setOpenBusy(true);
    setErrorMessage("");
    setStatusMessage("");
    try {
      const opened = await openPdfExternally(result.id, exportedReport.savedPath);
      if (opened.path !== exportedReport.savedPath) {
        const latest = { filename: opened.path.split(/[/\\]/).pop() || exportedReport.filename, savedPath: opened.path };
        setExportedReport(latest);
        writeStoredReport(result.id, latest);
      }
      setStatusMessage("Opened the displayed PDF using your default PDF viewer.");
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : "Could not open the PDF in an external viewer.");
    } finally {
      setOpenBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Step 4 of 4"
        title="Export local report"
        description="Create a PDF summary from the completed validation result. The report is generated locally and validation will not be re-run."
      />

      <section className={reportPanelClass}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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
          <button disabled={busy} onClick={generateReport} className={`${primaryActionClass} sm:mt-1`}>
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

        {statusMessage ? (
          <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800" role="status">
            {statusMessage}
          </p>
        ) : null}

        {exportedReport ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-emerald-700">
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
              <button type="button" onClick={openReport} disabled={openBusy} className={secondaryActionClass}>
                <ExternalLink className="size-4" /> {openBusy ? "Opening..." : "Open in PDF viewer"}
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
