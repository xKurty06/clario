import { ArrowRight, FileCheck2, LayoutTemplate, Plus, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { EmptyState } from "../components/common/EmptyState";
import { StatusBadge } from "../components/common/StatusBadge";
import { PageHeader } from "../components/layout/PageHeader";
import { listTemplates } from "../services/templateApi";
import { listRecentSessions, type RecentSession } from "../services/validationApi";

export function DashboardPage() {
  const [sessions, setSessions] = useState<RecentSession[]>([]);
  const [templateCount, setTemplateCount] = useState(0);
  useEffect(() => { void Promise.all([listRecentSessions(), listTemplates()]).then(([recent, templates]) => { setSessions(recent); setTemplateCount(templates.length); }).catch(() => undefined); }, []);
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
            <h2 className="text-base font-semibold">Recent sessions</h2>
            <StatusBadge tone="success">Version 1 ready</StatusBadge>
          </div>
          {sessions.length ? <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">{sessions.slice(0, 5).map((session) => <div key={session.id} className="flex items-center gap-4 p-4"><FileCheck2 className="size-5 text-emerald-700"/><div className="flex-1"><p className="text-sm font-semibold">{session.project_name}</p><p className="mt-1 text-xs text-slate-500">{new Date(session.created_at).toLocaleString()} · {session.mode.replaceAll("_", " ")}</p></div><StatusBadge tone={session.discrepancy_count ? "warning" : "success"}>{`${session.discrepancy_count} issues`}</StatusBadge></div>)}</div> : <EmptyState icon={FileCheck2} title="Start a validation session" description="Choose local procurement files, confirm their mappings, preview extracted rows, and run a traceable comparison." />}
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
