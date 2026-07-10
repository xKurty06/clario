import { FileSpreadsheet, FileUp, LoaderCircle, LockKeyhole, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FieldLabel, HelpTip, SelectField } from "../components/forms";
import { PageHeader } from "../components/layout/PageHeader";
import { useWorkflow } from "../features/files/WorkflowContext";
import { checkBackendHealth } from "../services/apiClient";
import { uploadFiles } from "../services/fileApi";
import { listRecentSessions } from "../services/validationApi";
import type { PresetSelection } from "../types/validation.types";
import { isSupportedFileName } from "../utils/validators";

const DEFAULT_SESSION_NAME = "New session";
const requiredBadgeClass = "rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold leading-5 text-amber-700";

function nextSessionName(existingNames: string[]) {
  const names = new Set(existingNames.map((name) => name.trim()).filter(Boolean));
  if (!names.has(DEFAULT_SESSION_NAME)) return DEFAULT_SESSION_NAME;
  let index = 2;
  while (names.has(`${DEFAULT_SESSION_NAME} (${index})`)) index += 1;
  return `${DEFAULT_SESSION_NAME} (${index})`;
}

export function UploadFilesPage() {
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const { projectName, setProjectName, preset, setPreset, files, setFiles, setDataSources, setRules, setResult } = useWorkflow();
  const [selected, setSelected] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [fileError, setFileError] = useState("");
  const [sessionNameError, setSessionNameError] = useState("");
  const [presetError, setPresetError] = useState("");
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    if (projectName.trim()) return;
    let active = true;
    void listRecentSessions()
      .then((sessions) => {
        if (active) setProjectName(nextSessionName(sessions.map((session) => session.project_name)));
      })
      .catch(() => {
        if (active) setProjectName(DEFAULT_SESSION_NAME);
      });
    return () => {
      active = false;
    };
  }, [projectName, setProjectName]);

  const add = (list: File[]) => {
    const valid = list.filter((file) => isSupportedFileName(file.name));
    setFileError(valid.length !== list.length ? "Only .xlsx, .xls, and .csv files are accepted." : "");
    setFormError("");
    setSelected((current) => [...current, ...valid].slice(0, 10));
  };

  const submit = async () => {
    let hasError = false;
    setFormError("");

    if (!selected.length) {
      setFileError("Please choose at least one spreadsheet before continuing.");
      hasError = true;
    } else {
      setFileError("");
    }

    if (!projectName.trim()) {
      setSessionNameError("Please enter a session name before continuing.");
      hasError = true;
    } else {
      setSessionNameError("");
    }

    if (!preset) {
      setPresetError("Please choose a comparison preset before continuing.");
      hasError = true;
    } else {
      setPresetError("");
    }

    if (hasError) {
      return;
    }

    setBusy(true);
    try {
      await checkBackendHealth();
      setFiles(await uploadFiles(selected));
      setDataSources([]);
      setRules([]);
      setResult(null);
      navigate("/mapping");
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Step 1 of 4"
        title="Choose comparison files"
        description="Select a comparison preset and local spreadsheets. Files are processed on this device and originals remain unchanged."
      />
      <div className="grid grid-cols-[320px_minmax(0,1fr)] gap-8 pt-8">
        <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
          <div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1">
                <label htmlFor="session-name" className="text-sm font-semibold text-slate-900">Session name</label>
                <HelpTip text="Give this review a clear name. The same name is used in the validation result and PDF report." />
              </div>
              <span className={requiredBadgeClass}>Required</span>
            </div>
            <input
              id="session-name"
              placeholder={DEFAULT_SESSION_NAME}
              value={projectName}
              onChange={(event) => {
                setProjectName(event.target.value);
                if (event.target.value.trim()) setSessionNameError("");
              }}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-600"
            />
            {sessionNameError && <p className="mt-2 text-xs font-medium text-red-700" role="alert">{sessionNameError}</p>}
          </div>
          <div>
            <div className="flex items-center justify-between gap-3">
              <FieldLabel
                className="text-sm text-slate-900"
                help="The preset only creates a starting structure. You can still customize sources, rows, fields, and rules later."
              >
                Comparison preset
              </FieldLabel>
              <span className={requiredBadgeClass}>Required</span>
            </div>
            <SelectField
              className="mt-2"
              ariaLabel="Comparison preset"
              value={preset}
              onChange={(value) => {
                setPreset(value as PresetSelection);
                if (value) setPresetError("");
              }}
              options={[
                { value: "", label: "Choose a comparison preset", description: "Required before continuing." },
                { value: "reference_vs_copied", label: "Reference vs Copied File", description: "Two sources with standard description and quantity checks." },
                { value: "reference_bidder_abstract", label: "Reference + Bidder + Abstract", description: "Three sources with procurement-oriented formula checks." },
                { value: "generic_two_file", label: "Generic Two-File Comparison", description: "Two flexible sources for arbitrary field-to-field checks." },
                { value: "custom_comparison_builder", label: "Custom Comparison Builder", description: "Start empty and define your own sources, fields, and rules." },
              ]}
            />
            {presetError && <p className="mt-2 text-xs font-medium text-red-700" role="alert">{presetError}</p>}
            <p className="mt-2 text-xs leading-5 text-slate-500">The preset only creates a starting structure. You can still customize sources, rows, fields, and rules later.</p>
          </div>
          <div className="rounded-xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
            <LockKeyhole className="mb-2 size-4" />
            No cloud upload, account, or internet connection is used.
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center gap-1 text-sm font-semibold text-slate-700">
            Files to compare
            <HelpTip text="Choose the Excel or CSV files you want to inspect. The app reads a temporary local copy and does not modify the originals." />
          </div>
          <button
            title="Choose local Excel or CSV files"
            type="button"
            onClick={() => input.current?.click()}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
              setDragActive(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragActive(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragActive(false);
              add([...event.dataTransfer.files]);
            }}
            className={`grid min-h-52 w-full place-items-center rounded-2xl border border-dashed p-8 text-center transition active:scale-[0.99] ${dragActive ? "border-emerald-600 bg-emerald-50 ring-4 ring-emerald-100" : "border-slate-300 bg-white hover:border-emerald-500 hover:bg-emerald-50/30"}`}
          >
            <span>
              <FileUp className={`mx-auto size-7 text-emerald-700 transition-transform ${dragActive ? "-translate-y-1 scale-110" : ""}`} />
              <span className="mt-3 block font-semibold">{dragActive ? "Release to add files" : "Drop spreadsheets here or browse"}</span>
              <span className="mt-1 block text-sm text-slate-500">Up to 10 files, 50 MB each</span>
            </span>
          </button>
          {fileError && <p className="mt-2 text-xs font-medium text-red-700" role="alert">{fileError}</p>}
          <input ref={input} hidden multiple type="file" accept=".xlsx,.xls,.csv" onChange={(event) => add([...(event.target.files ?? [])])} />

          <div className="mt-4 space-y-2">
            {selected.map((file, index) => (
              <div key={`${file.name}-${index}`} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                <FileSpreadsheet className="size-5 text-emerald-700" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{file.name}</span>
                <span className="text-xs text-slate-500">{(file.size / 1024).toFixed(0)} KB</span>
                <button title={`Remove ${file.name} from this review`} onClick={() => setSelected((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${file.name}`}>
                  <X className="size-4" />
                </button>
              </div>
            ))}
          </div>

          {formError && <p className="mt-3 text-sm text-red-700" role="alert">{formError}</p>}
          <button
            title="Read the selected files and continue to the comparison builder"
            disabled={busy}
            onClick={submit}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
            {busy ? "Inspecting files..." : "Continue to comparison builder"}
          </button>
          {files.length > 0 && <p className="mt-3 text-xs text-slate-500">{files.length} previously inspected file(s) in this session.</p>}
        </section>
      </div>
    </div>
  );
}
