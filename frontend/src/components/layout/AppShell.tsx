import {
  FileOutput,
  FileSearch,
  Files,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  PanelRightOpen,
  Settings2,
  SlidersHorizontal,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { appConfig } from "../../app/config";
import { CommonFieldsChooser } from "../validation/CommonFieldsChooser";
import { RowPreviewControls } from "../validation/RowPreviewControls";

interface NavigationSection {
  label: string;
  items: Array<{ to: string; label: string; icon: LucideIcon; end?: boolean }>;
}

const navigation: NavigationSection[] = [
  {
    label: "Overview",
    items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard, end: true }],
  },
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

const previewCopyReplacements = [
  ["Preview rows to detect candidate data rows and prepare field mapping", "Load a row preview to detect candidate data rows and prepare field mapping"],
  ["Preview rows for this source to enable row selection", "Load a row preview for this source to enable row selection"],
  ["Preview rows before selecting data rows.", "Load a preview before selecting data rows."],
  ["Preview this source before adding fields.", "Load this source preview before adding fields."],
  ["Refresh preview", "Reload preview"],
  ["Preview rows", "Load preview"],
] as const;

function applyPreviewCopy(value: string) {
  return previewCopyReplacements.reduce((text, [from, to]) => text.replaceAll(from, to), value);
}

function applyPreviewCopyAliases(root: ParentNode) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const nextValue = applyPreviewCopy(node.nodeValue ?? "");
    if (nextValue !== node.nodeValue) node.nodeValue = nextValue;
    node = walker.nextNode();
  }

  if (root instanceof Element || root instanceof Document || root instanceof DocumentFragment) {
    root.querySelectorAll<HTMLElement>("[title], [aria-label]").forEach((element) => {
      for (const attribute of ["title", "aria-label"]) {
        const value = element.getAttribute(attribute);
        if (!value) continue;
        const nextValue = applyPreviewCopy(value);
        if (nextValue !== value) element.setAttribute(attribute, nextValue);
      }
    });
  }
}

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const shellStyle = { "--app-sidebar-offset": collapsed ? "72px" : "272px" } as CSSProperties;

  useEffect(() => {
    let frame: number | null = null;
    const scheduleCopyUpdate = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        applyPreviewCopyAliases(document.body);
      });
    };

    scheduleCopyUpdate();
    const observer = new MutationObserver(scheduleCopyUpdate);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => {
      observer.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-slate-50 text-slate-950" style={shellStyle}>
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
              <span className="relative grid size-8 place-items-center overflow-hidden rounded-[10px] bg-emerald-700 text-white transition-transform duration-200 group-hover:scale-105 group-active:scale-95">
                <span className="text-xs font-bold transition-all duration-200 group-hover:-translate-x-2 group-hover:opacity-0 group-focus-visible:-translate-x-2 group-focus-visible:opacity-0">C</span>
                <PanelRightOpen aria-hidden="true" className="absolute size-[17px] translate-x-2 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100" />
              </span>
            </button>
          ) : (
            <>
              <div className="sidebar-expand-enter grid size-8 shrink-0 place-items-center rounded-[10px] bg-emerald-700 text-xs font-bold text-white">C</div>
              <div className="sidebar-expand-enter absolute left-[60px] right-[56px] min-w-0">
                <p className="truncate text-sm font-semibold" title={appConfig.displayName}>{appConfig.displayName}</p>
                <p className="truncate text-xs text-slate-500" title="Local validation workspace">Local validation workspace</p>
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

        <nav aria-label="Primary navigation" className={`flex-1 overflow-y-auto overflow-x-hidden ${collapsed ? "px-2 py-3" : "px-3 py-4"}`}>
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

        <div className={`shrink-0 ${collapsed ? "p-2" : "p-3"}`}>
          <div title={collapsed ? "Files stay on this Windows device" : undefined} className={`overflow-hidden border border-emerald-100 bg-emerald-50 text-emerald-800 transition-all duration-300 ${collapsed ? "mx-auto grid size-10 place-items-center rounded-xl p-0" : "rounded-xl p-3"}`}>
            {collapsed ? (
              <LockKeyhole aria-hidden="true" className="size-4" />
            ) : (
              <>
                <div className="flex min-w-0 items-center gap-2">
                  <LockKeyhole aria-hidden="true" className="size-4 shrink-0" />
                  <span className="min-w-0 truncate text-xs font-semibold" title="Local-only by design">Local-only by design</span>
                </div>
                <p className="mt-2 truncate text-xs leading-5 text-emerald-700" title="Files stay on this Windows device.">Files stay on this Windows device.</p>
              </>
            )}
          </div>
        </div>
      </aside>

      <main className={`min-w-0 px-4 py-6 pb-32 transition-[margin-left] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] sm:px-6 lg:px-8 lg:py-8 lg:pb-32 ${collapsed ? "ml-[72px]" : "ml-[272px]"}`}>
        <div className="mx-auto min-w-0 max-w-[1400px]">
          <div key={location.pathname} className="app-route-fade">
            <Outlet />
          </div>
        </div>
      </main>
      <RowPreviewControls />
      <CommonFieldsChooser />
    </div>
  );
}
