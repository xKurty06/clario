import { ArrowRight, Save, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "../components/common/EmptyState";
import { PageHeader } from "../components/layout/PageHeader";
import { FieldLabel, SelectField } from "../components/forms";
import { useWorkflow } from "../features/files/WorkflowContext";
import { saveTemplate } from "../services/templateApi";
import { inspectHeader } from "../services/fileApi";
import type { FileRole, MappingTemplate } from "../types/template.types";

const columnHelp: Record<string, string> = {
  description: "Select the column containing the full item name, specifications, brand, size, or other identifying details.",
  quantity: "Select the column showing how many units are required or offered. This is required for quantity and total checks.",
  item_number: "Select the item number or line number column when available. It helps match the same item across different files.",
  unit: "Select the measurement column, such as piece, box, ream, kilogram, or set.",
  unit_cost: "Select the price for one unit. In bidder files, this value is used to calculate the expected total.",
  total_cost: "Select the column containing quantity multiplied by unit cost, sometimes named Amount or Total Price.",
};

function createMapping(fileName: string, sheet: string, headers: string[], role: FileRole, headerRow = 1): MappingTemplate {
  const find = (terms: string[]) => headers.find((header) => terms.some((term) => header.toLowerCase().includes(term))) ?? "";
  const description = headers.find((header) => {
    const value = header.toLowerCase();
    return (value.includes("description") || value.includes("particular") || value.includes("specification")) && !value.includes("qty") && !value.includes("quantity") && !value.includes("unit") && !value.includes("price") && !value.includes("amount");
  }) ?? "";
  return {
    name: `${fileName} mapping`, file_role: role, included_sheets: [sheet], ignored_sheets: [],
    include_all_except_ignored: false, header_row: headerRow, first_data_row: headerRow + 1,
    columns: { description, quantity: find(["qty", "quantity"]), unit: find(["particulars / unit", " uom", "unit"]), unit_cost: find(["unit cost", "unit price", "unit / price"]), total_cost: find(["total cost", "total amount", "total / amount", "amount"]), item_number: find(["item no", "item number"]) },
    ignored_terms: ["total", "subtotal", "grand total", "signature", "prepared by", "page", "terms", "delivery", "payment"], case_insensitive: true,
  };
}

export function TemplateMappingPage() {
  const navigate = useNavigate();
  const { files, mode, templates, setTemplate } = useWorkflow();
  const [error, setError] = useState("");
  const [headerChoices, setHeaderChoices] = useState<Record<string, string[]>>({});
  const roleFor = (index: number): FileRole => mode === "reference_bidder_abstract" ? (index === 0 ? "reference" : index === 1 ? "bidder" : "abstract") : index === 0 ? "reference" : "generic";

  useEffect(() => {
    files.forEach((file, index) => {
      if (!templates[file.id]) setTemplate(file.id, createMapping(file.name, file.sheets[0]?.name ?? "", file.sheets[0]?.headers ?? [], roleFor(index), file.sheets[0]?.detected_header_row ?? 1));
    });
  }, [files, mode]);

  if (!files.length) return <div><PageHeader eyebrow="Step 2 of 5" title="Map sheets and columns" description="Upload files before creating mappings." /><div className="pt-8"><EmptyState icon={SlidersHorizontal} title="No files uploaded" description="Return to Upload files and inspect at least two spreadsheets." /></div></div>;
  const getTemplate = (index: number) => { const file = files[index]; if (!file) throw new Error("File mapping index is invalid."); return templates[file.id] ?? createMapping(file.name, file.sheets[0]?.name ?? "", file.sheets[0]?.headers ?? [], roleFor(index), file.sheets[0]?.detected_header_row ?? 1); };
  const ready = files.every((_, index) => { const template = getTemplate(index); return Boolean(template.columns.description && template.columns.quantity && template.included_sheets.length); });

  return <div><PageHeader eyebrow="Step 2 of 5" title="Map sheets and columns" description="Review every assisted mapping. Suggestions are rule-based and required fields must be confirmed." /><div className="space-y-6 pt-8">
    {files.map((file, index) => {
      const template = getTemplate(index); const sheet = file.sheets.find((item) => item.name === template.included_sheets[0]) ?? file.sheets[0]; const headers = headerChoices[file.id] ?? sheet?.headers ?? [];
      const update = (value: MappingTemplate) => setTemplate(file.id, value);
      const columnField = (key: keyof typeof template.columns, label: string, required = false) => <div><FieldLabel required={required} help={columnHelp[key] ?? "Select the spreadsheet column that contains this information."}>{label}</FieldLabel><SelectField compact className="mt-1" ariaLabel={`${file.name} ${label}`} value={template.columns[key] ?? ""} onChange={(value) => update({ ...template, columns: { ...template.columns, [key]: value || null } })} options={[{ value: "", label: "Not mapped", description: `Do not use a spreadsheet column for ${label.toLowerCase()}.` }, ...headers.map((header) => ({ value: header, label: header, description: `Use the “${header}” spreadsheet column as ${label.toLowerCase()}.` }))]} /></div>;
      return <section key={file.id} className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-end justify-between gap-5"><div className="min-w-0"><h2 className="truncate font-semibold">{file.name}</h2><p className="mt-1 text-xs text-slate-500">Role: {template.file_role} · {sheet?.row_count ?? 0} detected rows</p></div><div className="w-48 shrink-0"><FieldLabel help="Tell the application what this file is used for. Reference is the source of correct descriptions and quantities; Bidder supplies prices; Abstract/copied is the file being checked.">File role</FieldLabel><SelectField compact className="mt-1" ariaLabel={`${file.name} file role`} value={template.file_role} onChange={(value) => update({ ...template, file_role: value as FileRole })} options={[{value:"reference",label:"Reference",description:"The trusted source for correct item descriptions and quantities."},{value:"bidder",label:"Bidder",description:"The supplier or bidder file that provides unit prices."},{value:"abstract",label:"Abstract/copied",description:"The prepared or copied file that will be checked against the source files."},{value:"generic",label:"Generic",description:"A general comparison file without a special procurement role."}]} /></div></div>
        <div className="mt-5 grid grid-cols-4 gap-4"><div><FieldLabel help="Choose the worksheet tab that contains the procurement item rows you want to compare.">Sheet</FieldLabel><SelectField compact className="mt-1" ariaLabel={`${file.name} sheet`} value={template.included_sheets[0] ?? ""} onChange={(value) => { const next = file.sheets.find((item) => item.name === value); const mapped = createMapping(file.name, value, next?.headers ?? [], template.file_role, next?.detected_header_row ?? 1); setHeaderChoices((current) => ({...current, [file.id]: next?.headers ?? []})); update({ ...template, included_sheets: [value], header_row: mapped.header_row, first_data_row: mapped.first_data_row, columns: mapped.columns }); }} options={file.sheets.map((item) => ({value:item.name,label:item.name,description:`Use the “${item.name}” worksheet containing ${item.row_count} detected rows.`}))} /></div><div><FieldLabel help="Enter the Excel row containing column names such as Item Description, Quantity, Unit Cost, and Total Cost. Change this if the suggested columns look incorrect.">Header row</FieldLabel><input aria-label={`${file.name} header row`} type="number" min="1" max={sheet?.row_count ?? 1000000} value={template.header_row} onChange={(event) => update({...template, header_row:Number(event.target.value)})} onBlur={async (event) => { const row=Number(event.currentTarget.value); try { const inspected=await inspectHeader(file.id, template.included_sheets[0] ?? "", row); setHeaderChoices((current)=>({...current,[file.id]:inspected.headers})); const suggested=createMapping(file.name,template.included_sheets[0] ?? "",inspected.headers,template.file_role,row); update({...template,header_row:row,first_data_row:Math.max(template.first_data_row,row+1),columns:suggested.columns}); setError(""); } catch(cause) { setError(cause instanceof Error?cause.message:"Could not inspect the selected header row."); } }} className="mt-1 block min-h-9 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs outline-none transition focus:border-emerald-600 focus:ring-3 focus:ring-emerald-100" /></div>{columnField("description", "Description", true)}{columnField("quantity", "Quantity", true)}{columnField("item_number", "Item number")}{columnField("unit", "Unit")}{columnField("unit_cost", "Unit cost")}{columnField("total_cost", "Total cost")}<div><FieldLabel help="Enter the Excel row number where the first real item begins. Header titles and notes above this row will be skipped.">First data row</FieldLabel><input aria-label={`${file.name} first data row`} type="number" min={template.header_row+1} value={template.first_data_row} onChange={(event) => update({ ...template, first_data_row: Number(event.target.value) })} className="mt-1 block min-h-9 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs outline-none transition focus:border-emerald-600 focus:ring-3 focus:ring-emerald-100" /></div></div>
        <button title="Save these sheet and column choices so they can be reused for a similar file later" onClick={async () => { try { update(await saveTemplate(template)); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save template"); } }} className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-emerald-700"><Save className="size-4" />Save reusable template</button>
      </section>;
    })}
    {error && <p className="text-sm text-red-700">{error}</p>}<button title="Read the mapped rows and show them for confirmation before validation" disabled={!ready} onClick={() => navigate("/preview")} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Preview extracted rows<ArrowRight className="size-4" /></button>
  </div></div>;
}
