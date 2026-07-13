import { Wand2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { SelectField } from "../components/forms/SelectField";
import { ComparisonBuilderPage } from "./ComparisonBuilderPage";
import { RowSetupPage } from "./RowSetupPage";
import { useWorkflow } from "../features/files/WorkflowContext";
import type { UploadedFile } from "../types/file.types";
import type { ComparisonDataSource } from "../types/validation.types";
import { rolesForPreset } from "../utils/presetConfig";

const primaryButtonClass = "inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300";
const secondaryButtonClass = "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50";

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function sourceCount(files: UploadedFile[], preset: string) {
  const roles = rolesForPreset(preset);
  if (roles.length) return roles.length;
  return Math.max(1, Math.min(3, files.length));
}

function sourceRoleName(preset: string, index: number) {
  return rolesForPreset(preset)[index];
}

function createDataSource(file: UploadedFile, index: number, preset: string): ComparisonDataSource {
  const sheet = file.sheets[0];
  const headerRow = sheet?.detected_header_row ?? 1;
  const roleName = sourceRoleName(preset, index);
  return {
    id: makeId("source"),
    name: `${roleName ?? `Source ${index + 1}`} - ${file.name}`,
    file_id: file.id,
    file_name: file.name,
    sheet_name: sheet?.name ?? "",
    header_row: headerRow,
    first_data_row: headerRow + 1,
    row_setup_confirmed: false,
    selected_row_numbers: [],
    ignored_row_numbers: [],
    row_selection_mode: "auto_detected",
    fields: [],
  };
}

function scaffoldSources(files: UploadedFile[], preset: string) {
  const count = sourceCount(files, preset);
  return Array.from({ length: count }, (_, index) => {
    const file = files[index] ?? files[0];
    return file ? createDataSource(file, index, preset) : null;
  }).filter((source): source is ComparisonDataSource => Boolean(source));
}

function sourcesMatchPresetRoles(dataSources: ComparisonDataSource[], roles: string[]) {
  if (!roles.length || dataSources.length < roles.length) return false;
  return roles.every((role, index) => dataSources[index]?.name.startsWith(`${role} - `));
}

function dismissPresetBanner() {
  let attempts = 0;
  const clickStartManual = () => {
    attempts += 1;
    const buttons = Array.from(document.querySelectorAll("button"));
    const startManualButton = buttons.find((button) => button.textContent?.trim().includes("Start manually"));
    if (startManualButton) {
      startManualButton.click();
      return;
    }
    if (attempts < 20) window.setTimeout(clickStartManual, 50);
  };
  window.setTimeout(clickStartManual, 0);
}

export function PresetAwareComparisonBuilderPage() {
  const { files, preset, dataSources, setDataSources, removeSourcePreview } = useWorkflow();
  const [reviewRowSetup, setReviewRowSetup] = useState(false);
  const [rowSetupContinued, setRowSetupContinued] = useState(() => dataSources.length > 0 && dataSources.every((source) => source.row_setup_confirmed));
  const [chooserOpen, setChooserOpen] = useState(false);
  const [presetRolesApplied, setPresetRolesApplied] = useState(false);
  const rowSetupComplete = dataSources.length > 0 && dataSources.every((source) => source.row_setup_confirmed);
  const roles = useMemo(() => rolesForPreset(preset), [preset]);
  const roleSourcesApplied = useMemo(() => sourcesMatchPresetRoles(dataSources, roles), [dataSources, roles]);
  const presetSetupApplied = presetRolesApplied || roleSourcesApplied;

  const needsRowSetup = useMemo(
    () => files.length > 0 && (!dataSources.length || reviewRowSetup || !rowSetupComplete || !rowSetupContinued),
    [dataSources.length, files.length, reviewRowSetup, rowSetupComplete, rowSetupContinued],
  );

  useEffect(() => {
    if (!files.length || dataSources.length) return;
    setDataSources(scaffoldSources(files, preset));
  }, [dataSources.length, files, preset, setDataSources]);

  useEffect(() => {
    if (!rowSetupComplete) setRowSetupContinued(false);
  }, [rowSetupComplete]);

  useEffect(() => {
    setPresetRolesApplied(false);
  }, [preset]);

  useEffect(() => {
    if (presetSetupApplied && !needsRowSetup) dismissPresetBanner();
  }, [needsRowSetup, presetSetupApplied]);

  useEffect(() => {
    const interceptPresetSetup = (event: MouseEvent) => {
      if (!roles.length || chooserOpen || needsRowSetup || presetSetupApplied) return;
      const target = event.target as Element | null;
      if (!target || target.closest("[data-preset-role-dialog]")) return;
      const button = target.closest("button");
      if (!button?.textContent?.includes("Apply preset setup")) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setChooserOpen(true);
    };

    document.addEventListener("click", interceptPresetSetup, true);
    return () => document.removeEventListener("click", interceptPresetSetup, true);
  }, [chooserOpen, needsRowSetup, presetSetupApplied, roles.length]);

  const applyRoleChoices = (roleFileIds: string[]) => {
    const selectedFiles = roleFileIds
      .map((fileId) => files.find((file) => file.id === fileId))
      .filter((file): file is UploadedFile => Boolean(file));

    const usedSourceIds = new Set<string>();
    const selectedFileIds = new Set(selectedFiles.map((file) => file.id));

    const roleSources = selectedFiles.map((file, index) => {
      const existing = dataSources.find((source) => source.file_id === file.id) ?? dataSources[index];
      const base = existing ?? createDataSource(file, index, preset);
      const fileChanged = base.file_id !== file.id;
      const sheet = file.sheets[0];
      const headerRow = sheet?.detected_header_row ?? 1;
      usedSourceIds.add(base.id);
      if (fileChanged) removeSourcePreview(base.id);
      return {
        ...base,
        name: `${roles[index] ?? `Source ${index + 1}`} - ${file.name}`,
        file_id: file.id,
        file_name: file.name,
        sheet_name: fileChanged ? sheet?.name ?? "" : base.sheet_name,
        header_row: fileChanged ? headerRow : base.header_row,
        first_data_row: fileChanged ? headerRow + 1 : base.first_data_row,
        row_setup_confirmed: fileChanged ? false : base.row_setup_confirmed,
        selected_row_numbers: fileChanged ? [] : base.selected_row_numbers,
        ignored_row_numbers: fileChanged ? [] : base.ignored_row_numbers,
        row_selection_mode: fileChanged ? "auto_detected" : base.row_selection_mode,
        fields: fileChanged ? [] : base.fields,
      };
    });

    const remainingSources = dataSources.filter((source) => !usedSourceIds.has(source.id) && !selectedFileIds.has(source.file_id));
    dataSources.slice(0, roles.length).forEach((source) => {
      if (!roleSources.some((nextSource) => nextSource.id === source.id)) removeSourcePreview(source.id);
    });

    setDataSources([...roleSources, ...remainingSources]);
    setPresetRolesApplied(true);
    setChooserOpen(false);
    dismissPresetBanner();
  };

  if (needsRowSetup) {
    return <RowSetupPage onContinue={() => {
      setRowSetupContinued(true);
      setReviewRowSetup(false);
    }} />;
  }

  return (
    <>
      <ComparisonBuilderPage onBackToRowSetup={() => {
        setReviewRowSetup(true);
        setRowSetupContinued(false);
      }} />
      <PresetRoleChooser
        files={files}
        roles={roles}
        open={chooserOpen}
        onClose={() => setChooserOpen(false)}
        onApply={applyRoleChoices}
      />
    </>
  );
}

function PresetRoleChooser({
  files,
  roles,
  open,
  onClose,
  onApply,
}: {
  files: UploadedFile[];
  roles: string[];
  open: boolean;
  onClose: () => void;
  onApply: (roleFileIds: string[]) => void;
}) {
  const [roleFileIds, setRoleFileIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setRoleFileIds(roles.map((_, index) => files[index]?.id ?? files[0]?.id ?? ""));
  }, [files, open, roles]);

  if (!open) return null;

  const hasMissingChoice = roleFileIds.some((fileId) => !fileId);
  const uniqueChoices = new Set(roleFileIds.filter(Boolean));
  const shouldRequireUnique = files.length >= roles.length;
  const hasDuplicateChoice = shouldRequireUnique && uniqueChoices.size !== roleFileIds.length;
  const error = hasMissingChoice
    ? "Choose a file for every preset role."
    : hasDuplicateChoice
      ? "Choose a different uploaded file for each role."
      : "";
  const fileOptions = [
    { value: "", label: "Select uploaded file", description: "Choose which workbook should use this preset role." },
    ...files.map((file) => ({ value: file.id, label: file.name, description: `${file.extension.toUpperCase()} • ${file.sheets.length} sheet${file.sheets.length === 1 ? "" : "s"}` })),
  ];

  const dialog = (
    <div data-preset-role-dialog className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <button aria-label="Close preset setup chooser" className="absolute inset-0 bg-slate-950/45 backdrop-blur-[3px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="preset-role-title"
        className="relative w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl animate-[builder-dialog-in_180ms_cubic-bezier(0.16,1,0.3,1)_forwards]"
      >
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
            <Wand2 className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 id="preset-role-title" className="text-lg font-semibold text-slate-950">Choose preset file roles</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">Select which uploaded file should be used for each preset role.</p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {roles.map((role, index) => (
            <section key={role} className="rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-4 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-950">{role}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Choose the workbook that should be labeled as {role.toLowerCase()}.</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">Role {index + 1}</span>
              </div>
              <SelectField
                ariaLabel={`${role} uploaded file`}
                helpText={`Choose the uploaded workbook for ${role}.`}
                value={roleFileIds[index] ?? ""}
                options={fileOptions}
                onChange={(value) => {
                  const next = [...roleFileIds];
                  next[index] = value;
                  setRoleFileIds(next);
                }}
              />
            </section>
          ))}
        </div>

        {error ? <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{error}</p> : null}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>Cancel</button>
          <button type="button" disabled={Boolean(error)} onClick={() => onApply(roleFileIds)} className={primaryButtonClass}>
            <Wand2 className="size-4" /> Apply selected roles
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
