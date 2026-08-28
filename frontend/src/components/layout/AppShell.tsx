import {
  ArrowLeft,
  FileOutput,
  FileSearch,
  Files,
  LockKeyhole,
  Menu,
  PanelRightOpen,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { appConfig } from "../../app/config";
import { useWorkflow } from "../../features/files/WorkflowContext";
import { getSessionState, listRecentSessions, type RecentSession } from "../../services/validationApi";
import { CommonFieldsChooser } from "../validation/CommonFieldsChooser";
import { ThemeSwitcher } from "./ThemeSwitcher";

const logoLightSrc = "/assets/clario-logo_light.png";
const logoDarkSrc = "/assets/clario-logo_dark.png";

interface NavigationSection {
  label: string;
  items: Array<{ to: string; label: string; icon: LucideIcon; end?: boolean }>;
}

const navigation: NavigationSection[] = [
  {
    label: "Validation workflow",
    items: [
      { to: "/upload", label: "Upload files", icon: Files },
      { to: "/mapping", label: "Comparison builder", icon: SlidersHorizontal },
      { to: "/results", label: "Validation results", icon: FileSearch },
      { to: "/reports", label: "Export report", icon: FileOutput },
    ],
  },
  {
    label: "Management",
    items: [{ to: "/templates", label: "Templates", icon: Settings2 }],
  },
];

function formatSessionMeta(session: RecentSession) {
  const issues = `${session.discrepancy_count} issue${session.discrepancy_count === 1 ? "" : "s"}`;
  return session.has_report ? `${issues} · Report ready` : issues;
}

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarView, setSidebarView] = useState<"sessions" | "workflow">("sessions");
  const [sessions, setSessions] = useState<RecentSession[]>([]);
  const [sessionQuery, setSessionQuery] = useState("");
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [openingSessionId, setOpeningSessionId] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const {
    projectName,
    setProjectName,
    setPreset,
    setFiles,
    setDataSources,
    setRules,
    setResult,
    result,
  } = useWorkflow();
  const shellStyle = { "--app-sidebar-offset": collapsed ? "72px" : "272px" } as CSSProperties;

  const activeSessionName = result?.project_name || projectName || "No active session";
  const filteredSessions = useMemo(() => {
    const normalized = sessionQuery.trim().toLowerCase();
    if (!normalized) return sessions;
    return sessions.filter((session) => session.project_name.toLowerCase().includes(normalized));
  }, [sessionQuery, sessions]);

  const loadSessions = () => {
    setLoadingSessions(true);
    setSessionError("");
    void listRecentSessions()
      .then(setSessions)
      .catch((cause) => setSessionError(cause instanceof Error ? cause.message : "Could not load sessions."))
      .finally(() => setLoadingSessions(false));
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const startNewValidation = () => {
    setProjectName("");
    setPreset("");
    setFiles([]);
    setDataSources([]);
    setRules([]);
    setResult(null);
    setSidebarView("workflow");
    navigate("/upload");
  };

  const closeSession = () => {
    setProjectName("");
    setPreset("");
    setFiles([]);
    setDataSources([]);
    setRules([]);
    setResult(null);
    setSidebarView("sessions");
    navigate("/");
  };

  const openSession = async (session: RecentSession) => {
    setOpeningSessionId(session.id);
    setSessionError("");
    try {
      const state = await getSessionState(session.id);
      setProjectName(state.request?.project_name || state.result.project_name);
      setPreset(state.request?.preset || state.result.preset);
      setFiles(state.files ?? []);
      setDataSources(state.request?.data_sources || state.result.data_sources);
      setRules(state.request?.rules || []);
      setResult(state.result);
      setSidebarView("workflow");
      navigate("/results");
    } catch (cause) {
      setSessionError(cause instanceof Error ? cause.message : "Could not open this session.");
    } finally {
      setOpeningSessionId(null);
    }
  };

  const renderLogo = (className = "size-7 object-contain") => (
    <>
      <img src={logoLightSrc} alt="" aria-hidden="true" className={`clario-logo clario-logo--light ${className}`} />
      <img src={logoDarkSrc} alt="" aria-hidden="true" className={`clario-logo clario-logo--dark ${className}`} />
    </>
  );

  return (
    <div className="min-h-[100dvh] overflow-x-clip bg-slate-50 text-slate-950" style={shellStyle}>
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex flex-col overflow-hidden border-r border-slate-200 bg-white transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${collapsed ? "w-[72px]" : "w-[272px]"}`}
      >
        <div className={`relative flex h-[72px] shrink-0 items-center border-b border-slate-100 ${collapsed ? "justify-center px-3" : "px-4"}`}>
          {collapsed ? (
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              aria-label="Expand sidebar"
              title="Expand sidebar"
              className="group relative grid size-10 place-items-center rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            >
              <span className="relative grid size-8 place-items-center overflow-hidden rounded-[10px] bg-white transition-transform duration-200 group-hover:scale-105 group-active:scale-95">
                {renderLogo("size-7 object-contain transition-all duration-200 group-hover:-translate-x-2 group-hover:opacity-0 group-focus-visible:-translate-x-2 group-focus-visible:opacity-0")}
                <PanelRightOpen aria-hidden="true" className="absolute size-[17px] translate-x-2 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100" />
              </span>
            </button>
          ) : (
            <>
              <div className="sidebar-expand-enter grid size-8 shrink-0 place-items-center rounded-[10px] bg-white">
                {renderLogo()}
              </div>
              <div className="sidebar-expand-enter absolute left-[60px] right-[56px] min-w-0">
                <p className="truncate text-sm font-semibold" title={appConfig.displayName}>{appConfig.displayName}</p>
                <p className="truncate text-xs text-slate-500" title={sidebarView === "sessions" ? "Sessions workspace" : "Active workflow"}>{sidebarView === "sessions" ? "Sessions workspace" : "Active workflow"}</p>
              </div>
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
                className="sidebar-expand-enter ml-auto grid size-8 shrink-0 place-items-center rounded-lg text-slate-500 transition-colors duration-200 hover:bg-slate-100 hover:text-emerald-700 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
              >
                <Menu aria-hidden="true" className="size-[18px]" />
              </button>
            </>
          )}
        </div>

        {sidebarView === "sessions" ? (
          <div className={`flex-1 overflow-y-auto overflow-x-hidden ${collapsed ? "px-2 py-3" : "px-3 py-4"}`}>
            <button
              type="button"
              onClick={startNewValidation}
              className={`flex h-10 items-center rounded-xl bg-emerald-700 text-sm font-semibold text-white transition hover:bg-emerald-800 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${collapsed ? "mx-auto w-10 justify-center" : "w-full gap-3 px-3"}`}
              title="Start a new validation session"
              aria-label="Start a new validation session"
            >
              <Plus className="size-[18px] shrink-0" />
              <span className={`min-w-0 overflow-hidden truncate transition-all duration-300 ${collapsed ? "w-0 opacity-0" : "w-[150px] opacity-100"}`}>New validation</span>
            </button>

            {!collapsed ? (
              <>
                <div className="mt-4">
                  <label className="sr-only" htmlFor="session-search">Search sessions</label>
                  <div className="session-search-field flex h-10 w-full items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-left text-slate-800 outline-none transition duration-200 hover:border-slate-400 hover:bg-slate-50 focus-within:border-emerald-600 focus-within:ring-3 focus-within:ring-emerald-100">
                    <Search className="size-4 shrink-0" />
                    <input
                      id="session-search"
                      value={sessionQuery}
                      onChange={(event) => setSessionQuery(event.target.value)}
                      placeholder="Search sessions"
                      className="session-search-input min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-slate-950 outline-none placeholder:text-slate-400"
                    />
                    {sessionQuery ? (
                      <button
                        type="button"
                        onClick={() => setSessionQuery("")}
                        className="grid size-5 shrink-0 place-items-center rounded text-slate-400 hover:filter-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700"
                        aria-label="Clear session search"
                        title="Clear session search"
                      >
                        <X className="search-clear-icon size-3.5 text-slate-400 hover:text-red-600" />
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  <span>Sessions</span>
                  <button
                    type="button"
                    onClick={loadSessions}
                    disabled={loadingSessions}
                    className="grid size-7 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    title="Refresh sessions"
                    aria-label="Refresh sessions"
                  >
                    <RefreshCw aria-hidden="true" className={`size-3.5 ${loadingSessions ? "animate-spin" : ""}`} />
                  </button>
                </div>
                {sessionError ? <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">{sessionError}</p> : null}
                {loadingSessions ? <p className="mt-3 px-3 text-xs text-slate-500">Loading sessions...</p> : null}
                <div className="mt-2 space-y-1.5">
                  {filteredSessions.map((session) => {
                    const active = result?.id === session.id;
                    return (
                      <button
                        key={session.id}
                        type="button"
                        onClick={() => openSession(session)}
                        disabled={openingSessionId === session.id}
                        className={`w-full rounded-2xl px-3 py-2.5 text-left transition active:scale-[0.99] disabled:opacity-60 ${active ? "bg-emerald-50 text-emerald-800" : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"}`}
                        title={`Open ${session.project_name}`}
                      >
                        <span className="block truncate text-sm font-semibold">{session.project_name}</span>
                        <span className="mt-1 block truncate text-xs text-slate-500">{formatSessionMeta(session)}</span>
                        {session.latest_report_filename ? <span className="mt-1 block truncate text-[11px] text-emerald-700">{session.latest_report_filename}</span> : null}
                      </button>
                    );
                  })}
                  {!loadingSessions && !filteredSessions.length ? (
                    <p className="px-3 py-4 text-xs leading-5 text-slate-500">No sessions found. Start a new validation to create one.</p>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        ) : (
          <>
            <div className={`shrink-0 ${collapsed ? "px-2 py-3" : "px-3 py-4"}`}>
              <div className={`flex h-10 items-center ${collapsed ? "justify-center" : "gap-3 px-3"}`}>
                <button
                  type="button"
                  onClick={closeSession}
                  className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                  title={`Return to sessions from ${activeSessionName}`}
                  aria-label={`Return to sessions from ${activeSessionName}`}
                >
                  <ArrowLeft className="size-[18px]" />
                </button>
                <span className={`min-w-0 overflow-hidden truncate text-sm font-semibold text-slate-600 transition-all duration-300 ${collapsed ? "w-0 opacity-0" : "w-[150px] opacity-100"}`}>{activeSessionName}</span>
              </div>
            </div>
            <nav aria-label="Workflow navigation" className={`flex-1 overflow-y-auto overflow-x-hidden ${collapsed ? "px-2 py-1" : "px-3 py-1"}`}>
              {navigation.map((section, sectionIndex) => (
                <section className={sectionIndex ? `border-t transition-[margin,padding,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${collapsed ? "mt-1 border-transparent pt-0" : "mt-3 border-slate-100 pt-3"}` : ""} key={section.label}>
                  <div className={`overflow-hidden whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 transition-all duration-200 ${collapsed ? "mb-0 h-0 px-0 opacity-0" : "mb-1.5 h-4 px-3 opacity-100"}`}>
                    {section.label}
                  </div>
                  <div className="space-y-1">
                    {section.items.map(({ to, label, icon: Icon, end }) => (
                      <NavLink
                        aria-label={label}
                        className={({ isActive }) =>
                          `group flex h-10 items-center rounded-xl text-sm font-medium transition-colors duration-200 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${collapsed ? "mx-auto w-10 justify-center p-0" : "w-full gap-3 px-3"} ${
                            isActive ? "bg-emerald-50 text-emerald-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                          }`
                        }
                        end={end}
                        key={to}
                        title={collapsed ? label : undefined}
                        to={to}
                      >
                        <Icon aria-hidden="true" className="size-[18px] shrink-0" />
                        <span className={`min-w-0 overflow-hidden truncate transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${collapsed ? "w-0 -translate-x-2 opacity-0" : "w-[150px] translate-x-0 opacity-100 delay-75"}`}>{label}</span>
                      </NavLink>
                    ))}
                  </div>
                </section>
              ))}
            </nav>
          </>
        )}

        <div className={`flex shrink-0 items-center gap-2 ${collapsed ? "p-2" : "p-3"}`}>
          <div title="Files stays local" className={`min-w-0 overflow-hidden border border-emerald-100 bg-emerald-50 text-emerald-800 transition-all duration-300 ${collapsed ? "grid size-10 shrink-0 place-items-center rounded-xl p-0" : "flex min-h-10 flex-1 items-center rounded-xl px-3"}`}>
            {collapsed ? (
              <LockKeyhole aria-hidden="true" className="size-4" />
            ) : (
              <div className="flex min-w-0 items-center gap-2">
                <LockKeyhole aria-hidden="true" className="size-4 shrink-0" />
                <span className="min-w-0 truncate text-xs font-semibold">Files stays local</span>
              </div>
            )}
          </div>
          <ThemeSwitcher collapsed={collapsed} />
        </div>
      </aside>

      <main className={`min-w-0 px-3 py-10 pb-8 transition-[margin-left] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] sm:px-4 lg:px-6 lg:py-12 lg:pb-10 ${collapsed ? "ml-[72px]" : "ml-[272px]"}`}>
        <div className="mx-auto min-w-0 max-w-[1500px]">
          {sidebarView === "workflow" && result ? (
            <div className="mb-6 flex items-center gap-3 border-b border-slate-200 pb-4">
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-slate-950">{result.project_name}</p>
                <p className="text-xs text-slate-500">Last modified {new Date(result.created_at).toLocaleDateString()}</p>
              </div>
              <span className="ml-auto text-xs font-medium text-emerald-700">Active session</span>
            </div>
          ) : null}
          <div key={location.pathname} className="app-route-fade">
            <Outlet />
          </div>
        </div>
      </main>
      <CommonFieldsChooser />
    </div>
  );
}
