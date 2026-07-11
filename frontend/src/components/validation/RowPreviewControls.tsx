import { ChevronDown, LoaderCircle, Rows3 } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useWorkflow } from "../../features/files/WorkflowContext";
import { previewDataSource } from "../../services/fileApi";
import type { ComparisonDataSource } from "../../types/validation.types";

interface RowPreviewTarget {
  sourceId: string;
  mount: HTMLElement;
}

const toolbarButtonClass = "inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60";

function findRowPreviewArticle(source: ComparisonDataSource) {
  const headings = Array.from(document.querySelectorAll<HTMLElement>("main article h2"));
  const summaryText = `${source.selected_row_numbers.length} selected / ${source.ignored_row_numbers.length} ignored`;

  for (const heading of headings) {
    if (heading.textContent?.trim() !== source.name) continue;
    const article = heading.closest("article") as HTMLElement | null;
    if (!article) continue;
    const isRowsPreview = Boolean(article.querySelector("table")) && Boolean(article.textContent?.includes(summaryText));
    if (isRowsPreview) return article;
  }

  return null;
}

function ensureControlsMount(article: HTMLElement, sourceId: string) {
  const header = article.firstElementChild as HTMLElement | null;
  if (!header) return null;

  const existing = article.querySelector<HTMLElement>(`[data-row-preview-controls-slot=\"${sourceId}\"]`);
  if (existing) return existing;

  const mount = document.createElement("div");
  mount.dataset.rowPreviewControlsSlot = sourceId;
  mount.className = "flex shrink-0 flex-wrap items-center justify-end gap-2";
  header.appendChild(mount);
  return mount;
}

function applyCollapsedState(article: HTMLElement, collapsed: boolean) {
  Array.from(article.children).slice(1).forEach((child) => {
    if (!(child instanceof HTMLElement)) return;
    child.dataset.rowPreviewCollapsible = "true";
    child.hidden = collapsed;
  });
  article.dataset.rowPreviewCollapsed = String(collapsed);
}

function cleanupInactiveSlots(activeMounts: HTMLElement[]) {
  document.querySelectorAll<HTMLElement>("[data-row-preview-controls-slot]").forEach((mount) => {
    if (!activeMounts.includes(mount)) mount.remove();
  });

  document.querySelectorAll<HTMLElement>("[data-row-preview-collapsible]").forEach((element) => {
    const article = element.closest("article") as HTMLElement | null;
    if (article?.querySelector("[data-row-preview-controls-slot]")) return;
    element.hidden = false;
    delete element.dataset.rowPreviewCollapsible;
  });
}

function sameTargets(left: RowPreviewTarget[], right: RowPreviewTarget[]) {
  return left.length === right.length && left.every((item, index) => item.sourceId === right[index]?.sourceId && item.mount === right[index]?.mount);
}

export function RowPreviewControls() {
  const { dataSources, sourcePreviews, updateDataSource, setSourcePreview } = useWorkflow();
  const [targets, setTargets] = useState<RowPreviewTarget[]>([]);
  const [collapsedSources, setCollapsedSources] = useState<Record<string, boolean>>({});
  const [busySourceId, setBusySourceId] = useState<string | null>(null);
  const [sourceErrors, setSourceErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let frame: number | null = null;

    const syncTargets = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        const nextTargets: RowPreviewTarget[] = [];

        for (const source of dataSources) {
          if (!sourcePreviews[source.id]) continue;
          const article = findRowPreviewArticle(source);
          if (!article) continue;
          const mount = ensureControlsMount(article, source.id);
          if (!mount) continue;
          applyCollapsedState(article, Boolean(collapsedSources[source.id]));
          nextTargets.push({ sourceId: source.id, mount });
        }

        cleanupInactiveSlots(nextTargets.map((target) => target.mount));
        setTargets((current) => (sameTargets(current, nextTargets) ? current : nextTargets));
      });
    };

    syncTargets();
    const observer = new MutationObserver(syncTargets);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [collapsedSources, dataSources, sourcePreviews]);

  const reloadPreview = async (source: ComparisonDataSource) => {
    setBusySourceId(source.id);
    setSourceErrors((current) => ({ ...current, [source.id]: "" }));
    try {
      const preview = await previewDataSource(source);
      updateDataSource(source.id, preview.data_source);
      setSourcePreview(source.id, preview);
    } catch (cause) {
      setSourceErrors((current) => ({ ...current, [source.id]: cause instanceof Error ? cause.message : "Could not reload this preview." }));
    } finally {
      setBusySourceId(null);
    }
  };

  return (
    <>
      {targets.map((target) => {
        const source = dataSources.find((item) => item.id === target.sourceId);
        if (!source) return null;
        const collapsed = Boolean(collapsedSources[source.id]);
        const error = sourceErrors[source.id];

        return createPortal(
          <div className="flex flex-wrap items-center justify-end gap-2">
            {error ? <span className="max-w-64 rounded-lg bg-red-50 px-2 py-1 text-xs font-medium text-red-700" title={error}>{error}</span> : null}
            <button
              type="button"
              title="Reload this source preview after changing row selections, source settings, or workbook data"
              onClick={() => reloadPreview(source)}
              disabled={busySourceId === source.id}
              className={toolbarButtonClass}
            >
              {busySourceId === source.id ? <LoaderCircle className="size-4 animate-spin" /> : <Rows3 className="size-4" />}
              Reload preview
            </button>
            <button
              type="button"
              title={collapsed ? "Expand this preview table" : "Collapse this preview table to reduce page clutter"}
              aria-expanded={!collapsed}
              onClick={() => setCollapsedSources((current) => ({ ...current, [source.id]: !collapsed }))}
              className={toolbarButtonClass}
            >
              <ChevronDown className={`size-4 transition ${collapsed ? "-rotate-90" : ""}`} />
              {collapsed ? "Expand" : "Collapse"}
            </button>
          </div>,
          target.mount,
        );
      })}
    </>
  );
}
