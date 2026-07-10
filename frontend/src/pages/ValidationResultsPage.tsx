import { FileSearch, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "../components/common/EmptyState";
import { PageHeader } from "../components/layout/PageHeader";
import { SelectField } from "../components/forms";
import { useWorkflow } from "../features/files/WorkflowContext";

export function ValidationResultsPage() {
  const { result } = useWorkflow();
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("all");

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

  const filtered = result.discrepancies.filter((item) => {
    const matchesSeverity = severity === "all" || item.severity === severity;
    const haystack = `${item.rule_name} ${item.expected_value ?? ""} ${item.actual_value ?? ""} ${item.notes ?? ""}`.toLowerCase();
    return matchesSeverity && haystack.includes(query.toLowerCase());
  });

  return (
    <div>
      <PageHeader
        eyebrow="Step 3 of 4"
        title="Review rule-based discrepancies"
        description={`${result.discrepancies.length} discrepancy(s) across ${result.total_selected_rows} selected rows. Every issue remains traceable to file, sheet, row, field, and rule.`}
        action={<Link to="/reports" className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white">Export report</Link>}
      />

      <div className="grid grid-cols-4 divide-x divide-slate-200 border-b border-slate-200 py-6">
        {[
          ["Discrepancies", result.discrepancies.length],
          ["High severity", result.breakdown.high ?? 0],
          ["Rules", result.rule_summaries.length],
          ["Selected rows", result.total_selected_rows],
        ].map(([label, value]) => (
          <div key={String(label)} className="px-5 first:pl-0">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[320px_minmax(0,1fr)] gap-8 pt-6">
        <aside className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold">Rule breakdown</h2>
          <div className="mt-4 space-y-3">
            {result.rule_summaries.map((rule) => (
              <div key={rule.rule_id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">{rule.rule_name}</p>
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">{rule.discrepancy_count}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{rule.rule_type.replaceAll("_", " ")} · {rule.severity}</p>
              </div>
            ))}
          </div>
        </aside>

        <section>
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

          <div className="overflow-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs text-slate-600">
                <tr>
                  <th className="p-3">Rule</th>
                  <th className="p-3">Severity</th>
                  <th className="p-3">Left location</th>
                  <th className="p-3">Right location</th>
                  <th className="p-3">Expected</th>
                  <th className="p-3">Actual</th>
                  <th className="p-3">Notes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, index) => (
                  <tr key={`${item.rule_id}-${index}`} className="border-t border-slate-100 align-top">
                    <td className="p-3">
                      <p className="font-semibold">{item.rule_name}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.left_field_name ?? item.right_field_name ?? item.rule_type}</p>
                    </td>
                    <td className="p-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.severity === "high" ? "bg-red-50 text-red-700" : item.severity === "medium" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-700"}`}>{item.severity}</span>
                    </td>
                    <td className="p-3 text-xs text-slate-600">{item.left_file_name ?? "-"}<br />{item.left_sheet_name ?? "-"} · row {item.left_row_number ?? "-"}</td>
                    <td className="p-3 text-xs text-slate-600">{item.right_file_name ?? "-"}<br />{item.right_sheet_name ?? "-"} · row {item.right_row_number ?? "-"}</td>
                    <td className="max-w-xs p-3">{item.expected_value ?? "-"}</td>
                    <td className="max-w-xs p-3">{item.actual_value ?? "-"}</td>
                    <td className="max-w-sm p-3 text-slate-600">{item.suggested_correction ?? item.notes ?? "Review item."}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length && <p className="p-8 text-center text-sm text-slate-500">No discrepancies match the current filters.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
