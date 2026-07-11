import { Ban, CheckSquare, ChevronDown, MoreHorizontal, RotateCcw, Square, Table2 } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent, type MouseEvent } from "react";
import type { PreviewRow } from "../../types/validation.types";

interface RowSelectionTableProps {
  headers: string[];
  rows: PreviewRow[];
  onToggleRow: (rowNumber: number) => void;
  onSelectRows: (rowNumbers: number[]) => void;
  onIgnoreRows: (rowNumbers: number[]) => void;
  onMarkDataRows: (rowNumbers: number[]) => void;
}

interface DragSelectionState {
  startClientX: number;
  startClientY: number;
  currentClientX: number;
  currentClientY: number;
  startContentX: number;
  startContentY: number;
  currentContentX: number;
  currentContentY: number;
  baseSelectedRows: number[];
  mode: "include" | "exclude";
  hasMoved: boolean;
  originRowNumber: number;
}

const toolbarButtonClass = "inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600";
const rangeInputClass = "h-6 w-14 rounded-md border border-slate-200 bg-white px-1.5 text-center text-xs font-semibold text-slate-800 outline-none placeholder:font-medium placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";
const menuItemClass = "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus:bg-slate-50 focus:outline-none";
const menuSectionClass = "px-3 pt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400";
const dragThreshold = 4;
const autoScrollEdge = 48;

function rowText(row: PreviewRow) {
  return Object.values(row.cells).map((value) => String(value ?? "")).join(" ").trim();
}

function rowStatus(row: PreviewRow, headers: string[]) {
  const text = rowText(row);
  if (row.ignored) return { label: "Excluded", className: "bg-slate-100 text-slate-600" };
  if (!text) return { label: "Blank", className: "bg-zinc-100 text-zinc-600" };
  const headerHits = headers.filter((header) => header && text.toLowerCase().includes(header.toLowerCase())).length;
  if (headerHits >= Math.min(2, headers.length)) return { label: "Header-like", className: "bg-amber-50 text-amber-700" };
  if (row.selected) return { label: "Included", className: "bg-emerald-50 text-emerald-700" };
  return { label: "Not included", className: "bg-slate-50 text-slate-500" };
}

function normalizedSelectionBox(selection: DragSelectionState) {
  const left = Math.min(selection.startContentX, selection.currentContentX);
  const right = Math.max(selection.startContentX, selection.currentContentX);
  const top = Math.min(selection.startContentY, selection.currentContentY);
  const bottom = Math.max(selection.startContentY, selection.currentContentY);
  return { left, right, top, bottom };
}

function boxesIntersect(first: { left: number; right: number; top: number; bottom: number }, second: { left: number; right: number; top: number; bottom: number }) {
  return first.left <= second.right && first.right >= second.left && first.top <= second.bottom && first.bottom >= second.top;
}

function clientPointToContent(container: HTMLDivElement, clientX: number, clientY: number) {
  const bounds = container.getBoundingClientRect();
  return {
    x: clientX - bounds.left + container.scrollLeft,
    y: clientY - bounds.top + container.scrollTop,
  };
}

function elementContentBox(element: HTMLElement, container: HTMLDivElement) {
  const elementBounds = element.getBoundingClientRect();
  const containerBounds = container.getBoundingClientRect();
  return {
    left: elementBounds.left - containerBounds.left + container.scrollLeft,
    right: elementBounds.right - containerBounds.left + container.scrollLeft,
    top: elementBounds.top - containerBounds.top + container.scrollTop,
    bottom: elementBounds.bottom - containerBounds.top + container.scrollTop,
  };
}

export function RowSelectionTable({ headers, rows, onToggleRow, onSelectRows, onIgnoreRows, onMarkDataRows }: RowSelectionTableProps) {
  const visibleRows = rows.map((row) => row.row_number);
  const selectedRows = rows.filter((row) => row.selected).map((row) => row.row_number);
  const rowsContaining = (term: string) => rows.filter((row) => rowText(row).toLowerCase().includes(term)).map((row) => row.row_number);
  const blankRows = rows.filter((row) => !rowText(row)).map((row) => row.row_number);
  const [dragSelection, setDragSelection] = useState<DragSelectionState | null>(null);
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [rangeError, setRangeError] = useState("");
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const moreActionsRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef(new Map<number, HTMLTableRowElement>());
  const dragSelectionRef = useRef<DragSelectionState | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const autoScrollFrameRef = useRef<number | null>(null);

  useEffect(() => {
    dragSelectionRef.current = dragSelection;
  }, [dragSelection]);

  const rowsInsideSelection = (selection: DragSelectionState) => {
    const container = scrollContainerRef.current;
    if (!container) return [];
    const box = normalizedSelectionBox(selection);
    return rows
      .filter((row) => {
        const element = rowRefs.current.get(row.row_number);
        if (!element) return false;
        return boxesIntersect(elementContentBox(element, container), box);
      })
      .map((row) => row.row_number);
  };

  const applyBoxSelection = (selection: DragSelectionState) => {
    if (!selection.hasMoved) return;
    const rowsInBox = rowsInsideSelection(selection);
    const nextSelectedRows = new Set(selection.baseSelectedRows);
    for (const rowNumber of rowsInBox) {
      if (selection.mode === "include") {
        nextSelectedRows.add(rowNumber);
      } else {
        nextSelectedRows.delete(rowNumber);
      }
    }
    onSelectRows([...nextSelectedRows]);
  };

  const stopAutoScroll = () => {
    if (autoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
  };

  const startAutoScroll = () => {
    if (autoScrollFrameRef.current !== null) return;

    const scrollLoop = () => {
      const selection = dragSelectionRef.current;
      const pointer = lastPointerRef.current;
      const container = scrollContainerRef.current;
      if (!selection || !selection.hasMoved || !pointer || !container) {
        autoScrollFrameRef.current = null;
        return;
      }

      const bounds = container.getBoundingClientRect();
      let deltaY = 0;
      let deltaX = 0;
      if (pointer.y < bounds.top + autoScrollEdge) {
        deltaY = -Math.ceil((autoScrollEdge - (pointer.y - bounds.top)) / 4);
      } else if (pointer.y > bounds.bottom - autoScrollEdge) {
        deltaY = Math.ceil((autoScrollEdge - (bounds.bottom - pointer.y)) / 4);
      }
      if (pointer.x < bounds.left + autoScrollEdge) {
        deltaX = -Math.ceil((autoScrollEdge - (pointer.x - bounds.left)) / 4);
      } else if (pointer.x > bounds.right - autoScrollEdge) {
        deltaX = Math.ceil((autoScrollEdge - (bounds.right - pointer.x)) / 4);
      }

      if (deltaY || deltaX) {
        container.scrollTop += deltaY;
        container.scrollLeft += deltaX;
        const contentPoint = clientPointToContent(container, pointer.x, pointer.y);
        const nextSelection = {
          ...selection,
          currentClientX: pointer.x,
          currentClientY: pointer.y,
          currentContentX: contentPoint.x,
          currentContentY: contentPoint.y,
        };
        dragSelectionRef.current = nextSelection;
        setDragSelection(nextSelection);
        applyBoxSelection(nextSelection);
        autoScrollFrameRef.current = window.requestAnimationFrame(scrollLoop);
        return;
      }

      autoScrollFrameRef.current = null;
    };

    autoScrollFrameRef.current = window.requestAnimationFrame(scrollLoop);
  };

  useEffect(() => {
    if (!dragSelection) return undefined;

    const handleMouseMove = (event: globalThis.MouseEvent) => {
      const current = dragSelectionRef.current;
      const container = scrollContainerRef.current;
      if (!current || !container) return;
      lastPointerRef.current = { x: event.clientX, y: event.clientY };
      const distance = Math.hypot(event.clientX - current.startClientX, event.clientY - current.startClientY);
      const hasMoved = current.hasMoved || distance > dragThreshold;
      const contentPoint = clientPointToContent(container, event.clientX, event.clientY);
      const nextSelection = {
        ...current,
        currentClientX: event.clientX,
        currentClientY: event.clientY,
        currentContentX: contentPoint.x,
        currentContentY: contentPoint.y,
        hasMoved,
      };
      dragSelectionRef.current = nextSelection;
      setDragSelection(nextSelection);
      if (hasMoved) {
        applyBoxSelection(nextSelection);
        startAutoScroll();
      }
    };

    const handleMouseUp = () => {
      const current = dragSelectionRef.current;
      if (current && !current.hasMoved) {
        onToggleRow(current.originRowNumber);
      }
      stopAutoScroll();
      dragSelectionRef.current = null;
      lastPointerRef.current = null;
      setDragSelection(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("blur", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("blur", handleMouseUp);
      stopAutoScroll();
    };
  }, [dragSelection, onToggleRow]);

  useEffect(() => {
    if (!moreActionsOpen) return undefined;
    const closeOnOutsideClick = (event: globalThis.MouseEvent) => {
      if (moreActionsRef.current?.contains(event.target as Node)) return;
      setMoreActionsOpen(false);
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setMoreActionsOpen(false);
    };
    window.addEventListener("mousedown", closeOnOutsideClick);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("mousedown", closeOnOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [moreActionsOpen]);

  const handleRowMouseDown = (event: MouseEvent<HTMLTableRowElement>, row: PreviewRow) => {
    if (event.button !== 0) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    event.preventDefault();
    const mode = row.selected ? "exclude" : "include";
    const contentPoint = clientPointToContent(container, event.clientX, event.clientY);
    const initialSelection = {
      startClientX: event.clientX,
      startClientY: event.clientY,
      currentClientX: event.clientX,
      currentClientY: event.clientY,
      startContentX: contentPoint.x,
      startContentY: contentPoint.y,
      currentContentX: contentPoint.x,
      currentContentY: contentPoint.y,
      baseSelectedRows: selectedRows,
      mode,
      hasMoved: false,
      originRowNumber: row.row_number,
    } satisfies DragSelectionState;
    dragSelectionRef.current = initialSelection;
    lastPointerRef.current = { x: event.clientX, y: event.clientY };
    setDragSelection(initialSelection);
  };

  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, rowNumber: number) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onToggleRow(rowNumber);
  };

  const handleSelectRange = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const start = Number.parseInt(rangeStart, 10);
    const end = Number.parseInt(rangeEnd, 10);

    if (!Number.isInteger(start) || !Number.isInteger(end)) {
      setRangeError("Enter valid Excel row numbers.");
      return;
    }

    const lower = Math.min(start, end);
    const upper = Math.max(start, end);
    const rowsInRange = rows.filter((row) => row.row_number >= lower && row.row_number <= upper).map((row) => row.row_number);

    if (!rowsInRange.length) {
      setRangeError(`No preview rows found from Excel row ${lower} to ${upper}.`);
      return;
    }

    onSelectRows([...new Set([...selectedRows, ...rowsInRange])]);
    setRangeError("");
  };

  const runMoreAction = (action: () => void) => {
    action();
    setMoreActionsOpen(false);
  };

  const selectionBoxStyle = (() => {
    if (!dragSelection?.hasMoved) return undefined;
    const box = normalizedSelectionBox(dragSelection);
    return {
      left: box.left,
      top: box.top,
      width: Math.max(box.right - box.left, 1),
      height: Math.max(box.bottom - box.top, 1),
    } satisfies CSSProperties;
  })();

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 rounded-t-2xl border-b border-slate-200 bg-white p-3 text-xs font-semibold text-slate-700">
        <button title="Include all rows in this preview" aria-label="Include all rows in this preview" onClick={() => onSelectRows(visibleRows)} className={toolbarButtonClass}>
          <CheckSquare className="size-3.5" /> Select all
        </button>
        <button title="Clear the current row selection" aria-label="Clear the current row selection" onClick={() => onSelectRows([])} className={toolbarButtonClass}>
          <Square className="size-3.5" /> Select none
        </button>
        <button title="Invert which preview rows are included" aria-label="Invert which preview rows are included" onClick={() => onSelectRows(rows.filter((row) => !row.selected).map((row) => row.row_number))} className={toolbarButtonClass}>
          <RotateCcw className="size-3.5" /> Invert
        </button>
        <form
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100"
          onSubmit={handleSelectRange}
          title="Select preview rows by Excel row number range. These numbers come from the Excel row column in the table."
          aria-label="Select range by Excel row numbers"
        >
          <span className="whitespace-nowrap">Select range</span>
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold leading-4 text-slate-500" title="The start and end values use the Excel row numbers shown in the Excel row column.">
            Excel row
          </span>
          <label className="sr-only" htmlFor="row-range-start">Start Excel row</label>
          <input
            id="row-range-start"
            type="number"
            min={1}
            inputMode="numeric"
            placeholder="Start"
            value={rangeStart}
            onChange={(event) => {
              setRangeStart(event.target.value);
              setRangeError("");
            }}
            className={rangeInputClass}
            title="Starting Excel row number, based on the Excel row column"
          />
          <span className="text-slate-400">–</span>
          <label className="sr-only" htmlFor="row-range-end">End Excel row</label>
          <input
            id="row-range-end"
            type="number"
            min={1}
            inputMode="numeric"
            placeholder="End"
            value={rangeEnd}
            onChange={(event) => {
              setRangeEnd(event.target.value);
              setRangeError("");
            }}
            className={rangeInputClass}
            title="Ending Excel row number, based on the Excel row column"
          />
          <button
            type="submit"
            className="inline-flex h-6 items-center rounded-md bg-emerald-700 px-2 text-[11px] font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"
            title="Select all preview rows between the entered Excel row numbers"
            aria-label="Select Excel row range"
          >
            Select
          </button>
        </form>
        {rangeError ? <span className="rounded-lg bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700" role="alert">{rangeError}</span> : null}
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <div ref={moreActionsRef} className="relative">
          <button
            type="button"
            title="Open extra row cleanup and include/exclude actions"
            aria-label="Open more row actions"
            aria-haspopup="menu"
            aria-expanded={moreActionsOpen}
            onClick={() => setMoreActionsOpen((open) => !open)}
            className={toolbarButtonClass}
          >
            <MoreHorizontal className="size-3.5" /> More row actions <ChevronDown className={`size-3.5 transition ${moreActionsOpen ? "rotate-180" : ""}`} />
          </button>
          {moreActionsOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-full z-30 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/70"
            >
              <p className={menuSectionClass}>Selection</p>
              <button role="menuitem" type="button" onClick={() => runMoreAction(() => onSelectRows(visibleRows))} className={menuItemClass} title="Include the rows currently shown in this preview table">
                <Table2 className="size-3.5" /> Select visible
              </button>
              <button role="menuitem" type="button" onClick={() => runMoreAction(() => onIgnoreRows(selectedRows))} className={menuItemClass} title="Move the currently selected rows to excluded rows so validation skips them">
                <Ban className="size-3.5" /> Exclude selected
              </button>
              <button role="menuitem" type="button" onClick={() => runMoreAction(() => onMarkDataRows(selectedRows))} className={menuItemClass} title="Move selected rows back into included data rows">
                <CheckSquare className="size-3.5" /> Include selected
              </button>
              <div className="my-1 h-px bg-slate-100" />
              <p className={menuSectionClass}>Clean rows</p>
              <button role="menuitem" type="button" onClick={() => runMoreAction(() => onIgnoreRows(blankRows))} className={menuItemClass} title="Exclude blank preview rows so they are skipped during validation">
                Exclude blank rows
              </button>
              <button role="menuitem" type="button" onClick={() => runMoreAction(() => onIgnoreRows(rowsContaining("total")))} className={menuItemClass} title="Exclude rows containing the word total">
                Exclude rows containing total
              </button>
              <button role="menuitem" type="button" onClick={() => runMoreAction(() => onIgnoreRows(rowsContaining("subtotal")))} className={menuItemClass} title="Exclude rows containing the word subtotal">
                Exclude rows containing subtotal
              </button>
              <button role="menuitem" type="button" onClick={() => runMoreAction(() => onIgnoreRows(rowsContaining("grand total")))} className={menuItemClass} title="Exclude rows containing the phrase grand total">
                Exclude rows containing grand total
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <div ref={scrollContainerRef} className="relative max-h-[520px] overflow-auto rounded-b-2xl bg-white">
        {selectionBoxStyle ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute z-20 rounded-2xl border border-emerald-500/70 bg-emerald-400/10 shadow-[0_0_0_1px_rgba(16,185,129,0.18),0_14px_35px_rgba(15,23,42,0.14)] backdrop-blur-[1px]"
            style={selectionBoxStyle}
          />
        ) : null}
        <table className={`w-full min-w-[760px] border-separate border-spacing-0 text-left text-xs ${dragSelection ? "select-none" : ""}`}>
          <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600">
            <tr>
              <th className="w-12 border-b border-slate-200 p-2.5 text-center">Use</th>
              <th className="w-24 border-b border-slate-200 p-2.5">Excel row</th>
              <th className="w-28 border-b border-slate-200 p-2.5">Status</th>
              {headers.map((header) => <th key={header} className="max-w-64 border-b border-slate-200 p-2.5">{header}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const status = rowStatus(row, headers);
              return (
                <tr
                  key={row.row_number}
                  ref={(element) => {
                    if (element) {
                      rowRefs.current.set(row.row_number, element);
                    } else {
                      rowRefs.current.delete(row.row_number);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`${row.selected ? "Unselect" : "Select"} Excel row ${row.row_number}`}
                  title="Click to toggle one row, or drag to draw a selection box across rows"
                  onMouseDown={(event) => handleRowMouseDown(event, row)}
                  onKeyDown={(event) => handleRowKeyDown(event, row.row_number)}
                  className={`group cursor-pointer border-t border-slate-100 align-middle transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-emerald-600 ${row.selected ? "bg-emerald-50/50" : ""} ${row.ignored ? "opacity-60" : ""}`}
                >
                  <td className="border-b border-slate-100 p-0 align-middle">
                    <div className="flex min-h-11 items-center justify-center px-2.5 py-2">
                      <input
                        type="checkbox"
                        aria-label={`${row.selected ? "Unselect" : "Select"} Excel row ${row.row_number}`}
                        checked={row.selected}
                        onClick={(event) => event.stopPropagation()}
                        onMouseDown={(event) => event.stopPropagation()}
                        onChange={() => onToggleRow(row.row_number)}
                        className="size-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                      />
                    </div>
                  </td>
                  <td className="border-b border-slate-100 p-2.5 align-middle font-semibold text-slate-700">{row.row_number}</td>
                  <td className="border-b border-slate-100 p-2.5 align-middle">
                    <span className={`inline-flex rounded-full px-2 py-1 font-semibold ${status.className}`}>{status.label}</span>
                  </td>
                  {headers.map((header) => (
                    <td key={`${row.row_number}-${header}`} className="max-w-64 truncate border-b border-slate-100 p-2.5 align-middle text-slate-700" title={String(row.cells[header] ?? "")}>
                      {String(row.cells[header] ?? "")}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
