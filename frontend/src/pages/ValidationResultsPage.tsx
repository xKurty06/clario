import { CheckCircle2, FileDown, FileSearch, LoaderCircle, RefreshCw, Search } from "lucide-react";
import { useEffect, useRef, useState, type UIEvent } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "../components/common/EmptyState";
import { SelectField } from "../components/forms";
import { PageHeader } from "../components/layout/PageHeader";
import { useWorkflow } from "../features/files/WorkflowContext";
import { checkBackendHealth } from "../services/apiClient";
import { runValidation } from "../services/validationApi";
import type { PresetType, RuleDiscrepancy, RuleType } from "../types/validation.types";

const ruleLabels: Record<RuleType, string> = {
  compare_values: "Compare two fields",
  formula_check: "Formula check",
  required_field_check: "Required field check",
  duplicate_check: "Duplicate check",
};

const severityOrder: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

interface SmartNote {
  title: string;
  detail: string;
}

function valueText(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function numberValue(value: unknown) {
  const text = valueText(value).replace(/,/g, "");
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function alphaNumericSignature(value: unknown) {
  return valueText(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function compactWhitespace(value: unknown) {
  return valueText(value).replace(/\s+/g, " ");
}

function fieldPair(item: RuleDiscrepancy) {
  return {
    expectedField: item.left_field_name || "expected field",
    actualField: item.right_field_name || "actual field",
  };
}

function ruleTypeNote(item: RuleDiscrepancy): SmartNote | null {
  if (item.rule_type === "required_field_check") {
    return {
      title: "Required value is missing",
      detail: `Fill in ${item.left_field_name || "the required field"}, or exclude the row if it is not a real data row.`,
    };
  }

  if (item.rule_type === "duplicate_check") {
    return {
      title: "Duplicate selected row",
      detail: "This value appears more than once in the selected rows. Keep one valid row or merge duplicate entries.",
    };
  }

  if (item.rule_type === "formula_check") {
    return {
      title: "Formula result does not match",
      detail: item.notes || `Recheck the source numbers used to calculate ${item.left_field_name || "the result field"}.`,
    };
  }

  return null;
}

function compareValueNote(item: RuleDiscrepancy): SmartNote {
  const expected = valueText(item.expected_value);
  const actual = valueText(item.actual_value);
  const { expectedField, actualField } = fieldPair(item);
  const expectedNumber = numberValue(expected);
  const actualNumber = numberValue(actual);
  const missingLeftLocation = !item.left_row_number;
  const missingRightLocation = !item.right_row_number;

  if (missingLeftLocation || missingRightLocation) {
    const missingSide = missingLeftLocation ? "left" : "right";
    const presentSide = missingSide === "left" ? "right" : "left";
    return {
      title: "Missing row match",
      detail: `The ${presentSide} side has a selected row, but the ${missingSide} side has no row with the same match key. The missing side is shown as Blank; check the match field or exclude the row if it should not be compared.`,
    };
  }

  if (!expected && actual) {
    return {
      title: "Unexpected value found",
      detail: `${actualField} has a value, but the trusted ${expectedField} is blank. Confirm the row pairing and selected rows.`,
    };
  }

  if (expected && !actual) {
    return {
      title: "Actual value is blank",
      detail: `${actualField} is missing. Copy or encode the trusted ${expectedField} value if the row should match.`,
    };
  }

  if (expectedNumber !== null && actualNumber !== null && expectedNumber !== actualNumber) {
    const difference = actualNumber - expectedNumber;
    const direction = difference > 0 ? "higher" : "lower";
    return {
      title: `Actual value is ${direction}`,
      detail: `${actualField} differs from ${expectedField} by ${Math.abs(difference).toLocaleString()}. Expected ${expected}, found ${actual}.`,
    };
  }

  if (expected && actual) {
    const expectedCase = compactWhitespace(expected).toLowerCase();
    const actualCase = compactWhitespace(actual).toLowerCase();
    const expectedSignature = alphaNumericSignature(expected);
    const actualSignature = alphaNumericSignature(actual);

    if (expectedCase === actualCase && compactWhitespace(expected) !== compactWhitespace(actual)) {
      return {
        title: "Capitalization or spacing only",
        detail: "The words appear the same after ignoring capitalization or extra spaces. Adjust the rule if this should be accepted.",
      };
    }

    if (expectedSignature && expectedSignature === actualSignature) {
      return {
        title: "Formatting difference only",
        detail: "The letters and numbers match, but punctuation, symbols, spacing, or unit formatting differ. Review whether formatting must match exactly.",
      };
    }

    return {
      title: "Text content does not match",
      detail: `Review wording, units, model details, or spelling in ${actualField}. Use the trusted ${expectedField} value if this row should match exactly.`,
    };
  }

  return {
    title: "Review this row pairing",
    detail: item.notes || item.suggested_correction || "The rule found a mismatch. Check the selected rows, fields, and match strategy.",
  };
}

function smartNoteFor(item: RuleDiscrepancy): SmartNote {
  return ruleTypeNote(item) ?? compareValueNote(item);
}

interface LocationCellProps {
  fileName?: string | null;
  sheetName?: string | null;
  rowNumber?: number | null;
}

function LocationCell({ fileName, sheetName, rowNumber }: LocationCellProps) {
  if (!fileName && !sheetName && !rowNumber) {
    return <span className="font-medium text-slate-400">No matching row</span>;
  }

  return (
    <>
      {fileName ?? "-"}
      <br />
      {sheetName ?? "-"} - row {rowNumber ?? <span className="font-medium text-slate-400">Blank</span>}
    </>
  );
}

function ValueCell({ value }: { value?: string | null }) {
  if (value === "Blank") {
    return <span className="font-medium text-slate-400">Blank</span>;
  }
  return <>{value ?? "-"}</>;
}

function firstDiscrepancyRow(item: RuleDiscrepancy) {
  const rows = [item.left_row_number, item.right_row_number].filter((row): row is number => typeof row === "number");
  return rows.length ? Math.min(...rows) : Number.MAX_SAFE_INTEGER;
}

function compareDiscrepancies(left: RuleDiscrepancy, right: RuleDiscrepancy) {
  const severityDelta = (severityOrder[left.severity] ?? 99) - (severityOrder[right.severity] ?? 99);
  if (severityDelta !== 0) return severityDelta;

  const rowDelta = firstDiscrepancyRow(left) - firstDiscrepancyRow(right);
  if (rowDelta !== 0) return rowDelta;

  return left.rule_name.localeCompare(right.rule_name, undefined, { sensitivity: "base" });
}

function compareRuleSummaries(
  left: NonNullable<ReturnType<typeof useWorkflow>["result"]>["rule_summaries"][number],
  right: NonNullable<ReturnType<typeof useWorkflow>["result"]>["rule_summaries"][number],
) {
  const countDelta = right.discrepancy_count - left.discrepancy_count;
  if (countDelta !== 0) return countDelta;

  const severityDelta = (severityOrder[left.severity] ?? 99) - (severityOrder[right.severity] ?? 99);
  if (severityDelta !== 0) return severityDelta;

  return left.rule_name.localeCompare(right.rule_name, undefined, { sensitivity: "base" });
}

function severityPillClass(severity: string) {
  if (severity === "high") return "bg-red-50 text-red-700";
  if (severity === "medium") return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

function isValidPreset(value: string): value is PresetType {
  return value === "reference_vs_copied" || value === "reference_bidder_abstract" || value === "generic_two_file" || value === "custom_comparison_builder";
}

export function ValidationResultsPage() {
  const { projectName, preset, dataSources, rules, result, setResult } = useWorkflow();
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("all");
  const [rerunBusy, setRerunBusy] = useState(false);
  const [rerunError, setRerunError] = useState("");
  const [rerunVisualState, setRerunVisualState] = useState<"loading" | "reloaded" | null>(null);
  const [showHorizontalSlider, setShowHorizontalSlider] = useState(false);
  const [tableScrollWidth, setTableScrollWidth] = useState(1080);
  const [floatingHeader, setFloatingHeader] = useState({ visible: false, left: 0, width: 0 });
  const tableFrameRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const floatingHeaderScrollRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const rerunVisualTimerRef = useRef<number | null>(null);

  const syncHorizontalScroll = (event: UIEvent<HTMLDivElement>, targets: Array<HTMLDivElement | null>) => {
    for (const target of targets) {
      if (!target || target.scrollLeft === event.currentTarget.scrollLeft) continue;
      target.scrollLeft = event.currentTarget.scrollLeft;
    }
  };

  const headerTable = (
    <table className="min-w-[1080px] w-full table-fixed text-left text-sm">
      <colgroup>
        <col className="w-[140px]" />
        <col className="w-[80px]" />
        <col className="w-[180px]" />
        <col className="w-[180px]" />
        <col className="w-[150px]" />
        <col className="w-[150px]" />
        <col className="w-[200px]" />
      </colgroup>
      <thead className="bg-slate-100 text-xs text-slate-600">
        <tr>
          <th className="p-3">Rule</th>
          <th className="p-3">Severity</th>
          <th className="p-3">Expected location</th>
          <th className="p-3">Actual location</th>
          <th className="p-3">Expected</th>
          <th className="p-3">Actual</th>
          <th className="p-3">Notes</th>
        </tr>
      </thead>
    </table>
  );

  const enriched = result?.discrepancies.map((item) => ({ item, note: smartNoteFor(item) })) ?? [];
  const filtered = enriched.filter(({ item, note }) => {
    const matchesSeverity = severity === "all" || item.severity === severity;
    const haystack = `${item.rule_name} ${item.expected_value ?? ""} ${item.actual_value ?? ""} ${item.notes ?? ""} ${item.suggested_correction ?? ""} ${note.title} ${note.detail}`.toLowerCase();
    return matchesSeverity && haystack.includes(query.toLowerCase());
  }).sort((left, right) => compareDiscrepancies(left.item, right.item));
  const sortedRuleSummaries = [...(result?.rule_summaries ?? [])].sort(compareRuleSummaries);
  const canRerun = isValidPreset(preset) && dataSources.length > 0 && rules.length > 0;

  const rerunValidation = async () => {
    setRerunBusy(true);
    setRerunError("");
    setRerunVisualState("loading");
    if (rerunVisualTimerRef.current) {
      window.clearTimeout(rerunVisualTimerRef.current);
      rerunVisualTimerRef.current = null;
    }
    try {
      if (!isValidPreset(preset)) {
        setRerunError("Please choose a comparison preset before re-running validation.");
        setRerunVisualState(null);
        return;
      }
      await checkBackendHealth();
      const nextResult = await runValidation({ project_name: projectName, preset, data_sources: dataSources, rules });
      setResult(nextResult);
      setRerunVisualState("reloaded");
      rerunVisualTimerRef.current = window.setTimeout(() => {
        setRerunVisualState(null);
        rerunVisualTimerRef.current = null;
      }, 900);
    } catch (cause) {
      setRerunError(cause instanceof Error ? cause.message : "Validation failed.");
      setRerunVisualState(null);
    } finally {
      setRerunBusy(false);
    }
  };

  useEffect(() => {
    const tableScroller = tableScrollRef.current;
    if (!tableScroller) {
      setShowHorizontalSlider(false);
      return;
    }

    const updateOverflow = () => {
      const maxScroll = Math.max(0, tableScroller.scrollWidth - tableScroller.clientWidth);
      const hasOverflow = maxScroll > 1;
      setShowHorizontalSlider(hasOverflow);
      setTableScrollWidth(tableScroller.scrollWidth);

      if (!hasOverflow) {
        tableScroller.scrollLeft = 0;
        if (headerScrollRef.current) headerScrollRef.current.scrollLeft = 0;
        if (topScrollRef.current) topScrollRef.current.scrollLeft = 0;
        if (floatingHeaderScrollRef.current) floatingHeaderScrollRef.current.scrollLeft = 0;
      }
    };

    updateOverflow();

    const resizeObserver = new ResizeObserver(updateOverflow);
    resizeObserver.observe(tableScroller);
    window.addEventListener("resize", updateOverflow);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateOverflow);
    };
  }, [query, result, severity]);

  useEffect(() => {
    const updateFloatingHeader = () => {
      const frame = tableFrameRef.current;
      const header = headerScrollRef.current;
      if (!frame || !header) {
        setFloatingHeader((current) => (current.visible ? { visible: false, left: 0, width: 0 } : current));
        return;
      }

      const frameRect = frame.getBoundingClientRect();
      const headerHeight = header.getBoundingClientRect().height;
      const visible = frameRect.top < 0 && frameRect.bottom > headerHeight;
      setFloatingHeader({ visible, left: frameRect.left, width: frameRect.width });

      if (floatingHeaderScrollRef.current && tableScrollRef.current) {
        floatingHeaderScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
      }
    };

    updateFloatingHeader();
    window.addEventListener("scroll", updateFloatingHeader, { passive: true });
    window.addEventListener("resize", updateFloatingHeader);

    return () => {
      window.removeEventListener("scroll", updateFloatingHeader);
      window.removeEventListener("resize", updateFloatingHeader);
    };
  }, [filtered.length, result]);

  useEffect(() => {
    return () => {
      if (rerunVisualTimerRef.current) {
        window.clearTimeout(rerunVisualTimerRef.current);
      }
    };
  }, []);

  if (!result) {
    return (
      <div>
        <PageHeader eyebrow="Step 3 of 4" title="Review rule results" description="Run validation from the comparison builder to populate results." />
        <div className="pt-8">
          <EmptyState icon={FileSearch} title="No validation result" description="Create data sources, fields, and rules first." />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Step 3 of 4"
        title="Review rule-based discrepancies"
        description={`${result.discrepancies.length} discrepancy(s) across ${result.total_selected_rows} selected rows. Every issue remains traceable to file, sheet, row, field, and rule.`}
        action={(
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={rerunValidation}
              disabled={rerunBusy || !canRerun}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.99]"
            >
              {rerunBusy ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              {rerunBusy ? "Re-running..." : "Re-run validation"}
            </button>
            <Link
              to="/reports"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 active:scale-[0.99]"
            >
              <FileDown className="size-4" />
              Export report
            </Link>
          </div>
        )}
      />

      {rerunError ? <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{rerunError}</p> : null}

      <div className="grid grid-cols-2 divide-x divide-y divide-slate-200 border-b border-slate-200 py-3 sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0">
        {[
          ["Discrepancies", result.discrepancies.length],
          ["High", result.breakdown.high ?? 0],
          ["Medium", result.breakdown.medium ?? 0],
          ["Low", result.breakdown.low ?? 0],
          ["Selected rows", result.total_selected_rows],
        ].map(([label, value]) => (
          <div key={String(label)} className="px-4 py-2 first:pl-0 lg:py-0">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-0.5 text-xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid items-start gap-5 pt-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="h-fit self-start rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Rule breakdown</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{result.rule_summaries.length}</span>
          </div>
          <div className="mt-3 max-h-[calc(100dvh-18rem)] space-y-2 overflow-y-auto pr-1">
            {sortedRuleSummaries.map((rule) => (
              <div key={rule.rule_id} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm shadow-slate-200/40">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 text-sm font-semibold leading-5">{rule.rule_name}</p>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{rule.discrepancy_count}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs leading-5 text-slate-500">{ruleLabels[rule.rule_type]}</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-4 ${severityPillClass(rule.severity)}`}>{rule.severity}</span>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <section className="min-w-0">
          <div className="mb-5 flex gap-3">
            <label className="relative flex-1">
              <Search className="absolute left-3 top-3 size-4 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search rule names, expected values, or notes"
                className="min-h-11 w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-emerald-600 focus:ring-3 focus:ring-emerald-100"
              />
            </label>
            <SelectField
              className="w-48"
              ariaLabel="Filter by severity"
              value={severity}
              onChange={setSeverity}
              options={[
                { value: "all", label: "All severities" },
                { value: "high", label: "High" },
                { value: "medium", label: "Medium" },
                { value: "low", label: "Low" },
              ]}
            />
          </div>

          <div
            ref={tableFrameRef}
            className="relative rounded-2xl border border-slate-200 bg-white"
          >
            {rerunVisualState ? (
              <div className="pointer-events-none absolute inset-0 z-[85] rounded-2xl" aria-live="polite" aria-label="Re-running validation">
                <div
                  className={`absolute left-1/2 top-20 inline-flex -translate-x-1/2 items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold shadow-lg shadow-slate-200/60 animate-[app-section-fade-in_180ms_cubic-bezier(0.16,1,0.3,1)_both] ${
                    rerunVisualState === "loading" ? "border-slate-200 bg-white text-slate-700" : "border-emerald-100 bg-white text-emerald-700"
                  }`}
                >
                  {rerunVisualState === "loading" ? <LoaderCircle className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  {rerunVisualState === "loading" ? "Re-running validation..." : "Validation re-run"}
                </div>
              </div>
            ) : null}

            {floatingHeader.visible ? (
              <div
                className="fixed top-0 z-[90] overflow-hidden border-b border-slate-200 bg-white shadow-md"
                style={{ left: floatingHeader.left, width: floatingHeader.width }}
              >
                <div ref={floatingHeaderScrollRef} className="overflow-hidden">
                  {headerTable}
                </div>
              </div>
            ) : null}

            <div className="sticky top-0 z-[80] overflow-hidden rounded-t-2xl bg-white shadow-sm">
              {showHorizontalSlider ? (
                <div
                  ref={topScrollRef}
                  aria-label="Scroll discrepancy table horizontally"
                  className="h-4 overflow-x-auto overflow-y-hidden border-b border-slate-200 bg-white"
                  onScroll={(event) => syncHorizontalScroll(event, [headerScrollRef.current, floatingHeaderScrollRef.current, tableScrollRef.current])}
                >
                  <div className="h-px" style={{ width: tableScrollWidth }} />
                </div>
              ) : null}

              <div
                ref={headerScrollRef}
                className="overflow-hidden border-b border-slate-200 bg-white"
              >
                {headerTable}
              </div>
            </div>

            <div
              ref={tableScrollRef}
              className={`overflow-x-auto transition duration-300 ${rerunVisualState === "loading" ? "scale-[0.998] opacity-65 blur-[0.7px] saturate-[0.96]" : ""}`}
              onScroll={(event) => syncHorizontalScroll(event, [headerScrollRef.current, floatingHeaderScrollRef.current, topScrollRef.current])}
            >
              <table className="min-w-[1080px] w-full table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-[140px]" />
                  <col className="w-[80px]" />
                  <col className="w-[180px]" />
                  <col className="w-[180px]" />
                  <col className="w-[150px]" />
                  <col className="w-[150px]" />
                  <col className="w-[200px]" />
                </colgroup>
                <tbody>
                  {filtered.map(({ item, note }, index) => (
                    <tr key={`${item.rule_id}-${index}`} className="border-t border-slate-100 align-top first:border-t-0">
                      <td className="p-3">
                        <p className="font-semibold leading-5">{item.rule_name}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.left_field_name ?? item.right_field_name ?? ruleLabels[item.rule_type]}</p>
                      </td>
                      <td className="p-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.severity === "high" ? "bg-red-50 text-red-700" : item.severity === "medium" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-700"}`}>{item.severity}</span>
                      </td>
                      <td className="break-words p-3 text-xs text-slate-600">
                        <LocationCell fileName={item.left_file_name} rowNumber={item.left_row_number} sheetName={item.left_sheet_name} />
                      </td>
                      <td className="break-words p-3 text-xs text-slate-600">
                        <LocationCell fileName={item.right_file_name} rowNumber={item.right_row_number} sheetName={item.right_sheet_name} />
                      </td>
                      <td className="break-words p-3"><ValueCell value={item.expected_value} /></td>
                      <td className="break-words p-3"><ValueCell value={item.actual_value} /></td>
                      <td className="break-words p-3 text-slate-600">
                        <p className="font-semibold text-slate-900">{note.title}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{note.detail}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filtered.length && <p className="p-8 text-center text-sm text-slate-500">No discrepancies match the current filters.</p>}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
