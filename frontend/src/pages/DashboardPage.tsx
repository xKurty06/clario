import { ArrowRight, FileCheck2, FileDown, LayoutTemplate, LoaderCircle, Plus, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { EmptyState } from "../components/common/EmptyState";
import { StatusBadge } from "../components/common/StatusBadge";
import { PageHeader } from "../components/layout/PageHeader";
import { useWorkflow } from "../features/files/WorkflowContext";
import { listTemplates } from "../services/templateApi";
import { getSessionState, listRecentSessions, type RecentSession } from "../services/validationApi";

function fileSummary(fileNames: string[]) {
  if (!fileNames.length) return "No file list saved";
  if (fileNames.length === 1) return fileNames[0];
  return `${fileNames.slice(0, 2).join(", ")}${fileNames.length > 2 ? ` +${fileNames.length - 2} more` : ""}`;
}

function formatSessionDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Saved session" : date.toLocaleString();
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { setProjectName, setPreset, setFiles, setDataSources, setRules, setResult } = useWorkflow();
  const [sessions, setSessions] = useState<RecentSession[]>([]);
  const [templateCount, setTemplateCount] = useState(0);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState("");

  useEffect(() => {
    void Promise.all([listRecentSessions(), listTemplates()])
      .then(([recent, templates]) => {
        setSessions(recent);
        setTemplateCount(templates.length);
      })
      .catch(() => undefined);
  }, []);

  const openSession = async (session: RecentSession, destination: "/mapping" | "/results" | "/reports") => {
    setLoadingSessionId(session.id);
    setSessionError("");
    try {
      const state = await getSessionState(session.id);
      setResult(state.result);
      setFiles(state.files ?? []);
      setProjectName(state.result.project_name);
      setPreset(state.result.preset);
      setDataSources(state.request?.data_sources ?? state.result.data_sources);
      setRules(state.request?.rules ?? []);
      navigate(destination);
    } catch (cause) {
      setSessionError(cause instanceof Error ? cause.message : "Could not reopen this session.");
    } finally {
      setLoadingSessionId(null);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Review procurement files with a traceable workflow"
        description="Set up mappings, confirm extracted rows, and review every discrepancy before creating a report. Validation will remain rule-based and local."
        action={
          <Link className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700" to="/upload">
            <Plus aria-hidden="true" className="size-4" /> New validation
          </Link>
        }
      />
      <section className="grid grid-cols-3 divide-x divide-slate-200 border-b border-slate-200 py-7" aria-label="Workspace summary">
        {[
          { label: "Recent sessions", value: String(sessions.length), icon: FileCheck2 },
          { label: "Saved templates", value: String(templateCount), icon: LayoutTemplate },
          { label: "Storage mode", value: "Local", icon: ShieldCheck },
        ].map(({ label, value, icon: Icon }) => (
          <div className="px-6 first:pl-0" key={label}>
            <div className="flex items-center gap-2 text-sm text-slate-500"><Icon className="size-4" aria-hidden="true" />{label}</div>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
          </div>
        ))}
      </section>
      <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-8 pt-8">
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Recent sessions</h2>
              <p className="mt-1 text-sm text-slate-500">Open a previous validation result or continue from its saved setup.</p>
            </div>
            <StatusBadge tone="success">Saved locally</StatusBadge>
          </div>
          {sessionError ? <p className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">{sessionError}</p> : null}
          {sessions.length ? (
            <div className="divide-y divide-[var(--color-border)] rounded-2xl border border-slate-200 bg-white">
              {sessions.slice(0, 8).map((session) => {
                const loading = loadingSessionId === session.id;
                return (
                  <div key={session.id} className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                    <div className="flex min-w-0 gap-4">
                      <FileCheck2 className="mt-0.5 size-5 shrink-0 text-emerald-700" />
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="min-w-0 truncate text-sm font-semibold text-slate-950">{session.project_name}</p>
                          <StatusBadge tone={session.discrepancy_count ? "warning" : "success"}>{`${session.discrepancy_count} issues`}</StatusBadge>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{formatSessionDate(session.created_at)} · {session.mode.replaceAll("_", " ")}</p>
                        <p className="mt-1 truncate text-xs text-slate-500">{fileSummary(Array.isArray(session.file_names) ? session.file_names : [])}</p>
                        {session.latest_report_filename ? <p className="mt-1 truncate text-xs text-emerald-700">Latest report: {session.latest_report_filename}</p> : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <button
                        type="button"
                        onClick={() => openSession(session, "/results")}
                        disabled={loading || session.can_reopen === false}
                        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {loading ? <LoaderCircle className="size-4 animate-spin" /> : null}
                        Open result
                      </button>
                      <button
                        type="button"
                        onClick={() => openSession(session, session.can_continue_setup ? "/mapping" : "/results")}
                        disabled={loading || session.can_reopen === false}
                        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Continue setup
                      </button>
                      <button
                        type="button"
                        onClick={() => openSession(session, "/reports")}
                        disabled={loading || session.can_reopen === false}
                        className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <FileDown className="size-4" /> Report
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <EmptyState icon={FileCheck2} title="Start a validation session" description="Choose local procurement files, confirm their mappings, preview extracted rows, and run a traceable comparison." />}
        </section>
        <aside className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Workflow</p>
          <ol className="mt-4 space-y-4 text-sm">
            {["Choose local files", "Map sheets and columns", "Confirm extracted rows", "Review discrepancies", "Export a PDF report"].map((step, index) => (
              <li className="flex gap-3" key={step}><span className="grid size-6 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">{index + 1}</span><span className="pt-0.5 text-slate-700">{step}</span></li>
            ))}
          </ol>
          <Link className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-800" to="/upload">Open file setup <ArrowRight aria-hidden="true" className="size-4" /></Link>
        </aside>
      </div>
    </div>
  );
}
