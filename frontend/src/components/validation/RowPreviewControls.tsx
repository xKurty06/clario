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
const smoothCollapseTiming = "360ms cubic-bezier(0.16, 1, 0.3, 1)";

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

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

  const existing = article.querySelector<HTMLElement>(`[data-row-preview-controls-slot="${sourceId}"]`);
  if (existing) return existing;

  const mount = document.createElement("div");
  mount.dataset.rowPreviewControlsSlot = sourceId;
  mount.className = "flex shrink-0 flex-wrap items-center justify-end gap-2";
  header.appendChild(mount);
  return mount;
}

function prepareCollapsibleElement(element: HTMLElement) {
  element.dataset.rowPreviewCollapsible = "true";
  element.style.overflow = "hidden";
  element.style.transition = [
    `max-height ${smoothCollapseTiming}`,
    `opacity ${smoothCollapseTiming}`,
    `transform ${smoothCollapseTiming}`,
  ].join(", ");
  element.style.willChange = "max-height, opacity, transform";
}

function finishExpandedElement(element: HTMLElement) {
  if (element.dataset.rowPreviewCollapsed === "true") return;
  delete element.dataset.rowPreviewAnimating;
  element.hidden = false;
  element.style.maxHeight = "";
  element.style.opacity = "";
  element.style.transform = "";
  element.style.pointerEvents = "";
}

function finishCollapsedElement(element: HTMLElement) {
  delete element.dataset.rowPreviewAnimating;
  if (element.dataset.rowPreviewCollapsed !== "true") return;
  element.hidden = true;
  element.style.maxHeight = "0px";
  element.style.opacity = "0";
  element.style.transform = "translateY(-4px)";
  element.style.pointerEvents = "none";
}

function setCollapsibleElementState(element: HTMLElement, collapsed: boolean) {
  if (element.dataset.rowPreviewCollapsible !== "true") {
    prepareCollapsibleElement(element);
    element.dataset.rowPreviewCollapsed = String(collapsed);
    if (collapsed) {
      finishCollapsedElement(element);
    } else {
      finishExpandedElement(element);
    }
    return;
  }

  const wasCollapsed = element.dataset.rowPreviewCollapsed === "true";
  if (wasCollapsed === collapsed) {
    // MutationObserver syncs can run several times while an animation is still in
    // progress. Do not re-apply the final hidden/open state during that window,
    // or later preview tables can appear to collapse instantly.
    if (element.dataset.rowPreviewAnimating === "true") return;
    if (collapsed) {
      finishCollapsedElement(element);
    } else {
      finishExpandedElement(element);
    }
    return;
  }

  element.dataset.rowPreviewCollapsed = String(collapsed);

  if (prefersReducedMotion()) {
    if (collapsed) {
      finishCollapsedElement(element);
    } else {
      finishExpandedElement(element);
    }
    return;
  }

  element.dataset.rowPreviewAnimating = "true";
  element.ontransitionend = null;

  if (collapsed) {
    element.hidden = false;
    element.style.maxHeight = `${element.scrollHeight}px`;
    element.style.opacity = "1";
    element.style.transform = "translateY(0)";
    element.style.pointerEvents = "none";
    window.requestAnimationFrame(() => {
      element.style.maxHeight = "0px";
      element.style.opacity = "0";
      element.style.transform = "translateY(-4px)";
    });
    element.ontransitionend = (event) => {
      if (event.target !== element || event.propertyName !== "max-height") return;
      finishCollapsedElement(element);
    };
    return;
  }

  element.hidden = false;
  element.style.maxHeight = "0px";
  element.style.opacity = "0";
  element.style.transform = "translateY(-4px)";
  element.style.pointerEvents = "";
  window.requestAnimationFrame(() => {
    element.style.maxHeight = `${element.scrollHeight}px`;
    element.style.opacity = "1";
    element.style.transform = "translateY(0)";
  });
  element.ontransitionend = (event) => {
    if (event.target !== element || event.propertyName !== "max-height") return;
    finishExpandedElement(element);
  };
}

function applyCollapsedState(article: HTMLElement, collapsed: boolean) {
  Array.from(article.children).slice(1).forEach((child) => {
    if (!(child instanceof HTMLElement)) return;
    setCollapsibleElementState(child, collapsed);
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
    element.ontransitionend = null;
    element.style.maxHeight = "";
    element.style.opacity = "";
    element.style.overflow = "";
    element.style.pointerEvents = "";
    element.style.transform = "";
    element.style.transition = "";
    element.style.willChange = "";
    delete element.dataset.rowPreviewAnimating;
    delete element.dataset.rowPreviewCollapsible;
    delete element.dataset.rowPreviewCollapsed;
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
          <div className="flex flex-wrap items-center justify-end gap-2 animate-[app-section-fade-in_180ms_cubic-bezier(0.16,1,0.3,1)_both]">
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
              <ChevronDown className={`size-4 transition-transform ease-[cubic-bezier(0.16,1,0.3,1)] duration-[240ms] ${collapsed ? "-rotate-90" : ""}`} />
              {collapsed ? "Expand" : "Collapse"}
            </button>
          </div>,
          target.mount,
        );
      })}
    </>
  );
}
