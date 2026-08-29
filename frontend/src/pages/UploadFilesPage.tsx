import { FileSpreadsheet, FileUp, LoaderCircle, LockKeyhole, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HelpTip } from "../components/forms";
import { PageHeader } from "../components/layout/PageHeader";
import { useWorkflow } from "../features/files/WorkflowContext";
import { checkBackendHealth } from "../services/apiClient";
import { uploadFiles } from "../services/fileApi";
import { addSessionFile, createSessionDraft, deleteSessionFile, listRecentSessions } from "../services/validationApi";
import { isSupportedFileName } from "../utils/validators";

const DEFAULT_SESSION_NAME = "New session";
const requiredBadgeClass = "rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold leading-5 text-amber-700";
const uploadCardClass = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";

function formatFileSize(size: number) {
  if (!size) return "0 KB";
  const kilobytes = size / 1024;
  return kilobytes < 1024 ? `${kilobytes.toFixed(0)} KB` : `${(kilobytes / 1024).toFixed(1)} MB`;
}

function nextSessionName(existingNames: string[]) {
  const names = new Set(existingNames.map((name) => name.trim()).filter(Boolean));
  if (!names.has(DEFAULT_SESSION_NAME)) return DEFAULT_SESSION_NAME;
  let index = 2;
  while (names.has(`${DEFAULT_SESSION_NAME} (${index})`)) index += 1;
  return `${DEFAULT_SESSION_NAME} (${index})`;
}

function mergeUploadedFiles(existingFiles: { id: string; name: string }[], newFiles: { id: string; name: string }[]) {
  const merged = [...existingFiles];
  const seen = new Set(merged.map((file) => `${file.id || ""}:${file.name}`));
  for (const file of newFiles) {
    const key = `${file.id || ""}:${file.name}`;
    if (!seen.has(key)) {
      merged.push(file);
      seen.add(key);
    }
  }
  return merged;
}

export function UploadFilesPage() {
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const { sessionId, setSessionId, projectName, setProjectName, files, setFiles, dataSources, setDataSources, removeSourcePreview, rules, setRules, setResult } = useWorkflow();
  const [selected, setSelected] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [fileError, setFileError] = useState("");
  const [sessionNameError, setSessionNameError] = useState("");
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

  const createDraftSession = async (sessionName: string, uploadedFiles: { id: string; name: string }[]) => {
    if (!uploadedFiles.length) return;
    const response = await createSessionDraft({
      project_name: sessionName,
      file_names: uploadedFiles.map((file) => file.name),
      uploaded_file_ids: uploadedFiles.map((file) => file.id),
    });
    window.dispatchEvent(new CustomEvent("sessions:updated"));
    window.dispatchEvent(new CustomEvent("sidebar:view", { detail: { view: "workflow" } }));
    return response;
  };

  const add = (list: File[]) => {
    const valid = list.filter((file) => isSupportedFileName(file.name));
    setFileError(valid.length !== list.length ? "Only .xlsx, .xls, and .csv files are accepted." : "");
    setFormError("");
    setSelected((current) => {
      const existingKeys = new Set(current.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
      return [...current, ...valid.filter((file) => !existingKeys.has(`${file.name}:${file.size}:${file.lastModified}`))].slice(0, 10);
    });
  };

  const removeUploadedFile = async (fileId: string) => {
    const nextFiles = files.filter((file) => file.id !== fileId);
    setFiles(nextFiles);
    const affectedSourceIds = dataSources.filter((source) => source.file_id === fileId).map((source) => source.id);
    if (affectedSourceIds.length) {
      setDataSources(dataSources.filter((source) => source.file_id !== fileId));
      affectedSourceIds.forEach((id) => removeSourcePreview(id));
      setRules(rules.filter((rule) => !(rule.left_data_source_id && affectedSourceIds.includes(rule.left_data_source_id)) && !(rule.right_data_source_id && affectedSourceIds.includes(rule.right_data_source_id))));
    }
    if (!sessionId) return;
    try {
      await deleteSessionFile(sessionId, fileId);
      window.dispatchEvent(new CustomEvent("sessions:updated"));
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Could not remove this file from the saved session.");
    }
  };

  const submit = async () => {
    const hasExistingSessionFiles = files.length > 0;
    const hasOpenSession = Boolean(sessionId);
    setFormError("");
    setFileError("");
    if (!selected.length && !hasExistingSessionFiles && !hasOpenSession) {
      setFileError("Please choose at least one spreadsheet before continuing.");
      return;
    }
    if (!projectName.trim()) {
      setSessionNameError("Please enter a session name before continuing.");
      return;
    }
    setSessionNameError("");

    setBusy(true);
    try {
      await checkBackendHealth();
      if (selected.length) {
        const uploadedSelection = await uploadFiles(selected);
        const nextFiles = mergeUploadedFiles(files, uploadedSelection);
        setFiles(nextFiles);

        if (hasOpenSession) {
          await Promise.all(uploadedSelection.map((file) => addSessionFile(sessionId as string, file.id)));
          window.dispatchEvent(new CustomEvent("sessions:updated"));
        } else {
          const created = await createDraftSession(projectName.trim(), uploadedSelection);
          if (created) setSessionId(created.id);
        }
        setSelected([]);
      }

      if (!hasOpenSession && !sessionId) {
        setDataSources([]);
        setRules([]);
        setResult(null);
      }
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
        eyebrow="Validation"
        title="Choose comparison files"
        description="Select the local spreadsheets you want to inspect. Clario keeps the files in the active validation session and leaves the originals unchanged."
      />
      <div className="mt-6 rounded-3xl border border-emerald-100 bg-emerald-50/70 p-4 text-sm leading-6 text-emerald-900 shadow-sm">
        <p className="font-semibold">Before you continue</p>
        <p className="mt-1">Choose your files first. You can review rows, map fields, and configure validation rules before running the comparison.</p>
      </div>
      <div className="grid items-start gap-8 pt-8 xl:grid-cols-[320px_minmax(0,1fr)]">
        <section className={`${uploadCardClass} self-start space-y-5`}>
          <div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1">
                <label htmlFor="session-name" className="text-sm font-semibold text-slate-900">Session name</label>
                <HelpTip text="Give this validation session a clear name. It is also used for saved reports." />
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
          <div className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
            <LockKeyhole className="mt-0.5 size-4 shrink-0" />
            <span>No cloud upload, account, or internet connection is used.</span>
          </div>
        </section>

        <section className={`${uploadCardClass} min-w-0 self-start`}>
          <div className="mb-2 flex items-center gap-1 text-sm font-semibold text-slate-700">
            Files to compare
            <HelpTip text="Choose the Excel or CSV files you want to inspect. New files added to an existing session are saved immediately." />
          </div>
          <button
            title="Choose local Excel or CSV files"
            type="button"
            onClick={() => input.current?.click()}
            onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
            onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setDragActive(true); }}
            onDragLeave={(event) => { event.preventDefault(); if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragActive(false); }}
            onDrop={(event) => { event.preventDefault(); setDragActive(false); add([...event.dataTransfer.files]); }}
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
              <div key={`${file.name}-${index}`} className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                <FileSpreadsheet className="size-5 shrink-0 text-emerald-700" />
                <span className="min-w-0 flex-1 text-sm font-medium break-anywhere">{file.name}</span>
                <span className="shrink-0 text-xs text-slate-500">{formatFileSize(file.size)}</span>
                <button title={`Remove ${file.name} from this review`} onClick={() => setSelected((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${file.name}`} className="shrink-0"><X className="size-4" /></button>
              </div>
            ))}
          </div>

          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Uploaded in this session</p>
              {files.map((file) => (
                <div key={file.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                  <FileSpreadsheet className="size-5 shrink-0 text-emerald-700" />
                  <span className="min-w-0 flex-1 text-sm font-medium break-anywhere">{file.name}</span>
                  <span className="shrink-0 text-xs text-slate-500">{formatFileSize(file.size)}</span>
                  <button title={`Remove ${file.name} from this session`} onClick={() => removeUploadedFile(file.id)} aria-label={`Remove ${file.name}`} className="shrink-0"><X className="size-4" /></button>
                </div>
              ))}
            </div>
          )}

          {formError && <p className="mt-3 text-sm text-red-700" role="alert">{formError}</p>}
          <button title="Read the selected files and continue to validation" disabled={busy} onClick={submit} className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
            {busy ? "Inspecting files..." : "Continue to validation"}
          </button>
        </section>
      </div>
    </div>
  );
}
