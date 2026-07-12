import { createContext, useCallback, useContext, useMemo, useState, type PropsWithChildren } from "react";
import type { UploadedFile } from "../../types/file.types";
import type {
  ComparisonDataSource,
  ComparisonRule,
  DataSourcePreview,
  PresetSelection,
  ValidationResult,
} from "../../types/validation.types";

const STORED_RESULT_KEY = "clario:last-validation-result";
const LEGACY_STORED_RESULT_KEY = "procurement-validator:last-validation-result";

function readStoredResult() {
  if (typeof window === "undefined") return null;
  try {
    const value = window.sessionStorage.getItem(STORED_RESULT_KEY) ?? window.sessionStorage.getItem(LEGACY_STORED_RESULT_KEY);
    if (value && !window.sessionStorage.getItem(STORED_RESULT_KEY)) {
      window.sessionStorage.setItem(STORED_RESULT_KEY, value);
      window.sessionStorage.removeItem(LEGACY_STORED_RESULT_KEY);
    }
    return value ? (JSON.parse(value) as ValidationResult) : null;
  } catch {
    return null;
  }
}

function writeStoredResult(value: ValidationResult | null) {
  if (typeof window === "undefined") return;
  try {
    if (value) {
      window.sessionStorage.setItem(STORED_RESULT_KEY, JSON.stringify(value));
      window.sessionStorage.removeItem(LEGACY_STORED_RESULT_KEY);
    } else {
      window.sessionStorage.removeItem(STORED_RESULT_KEY);
      window.sessionStorage.removeItem(LEGACY_STORED_RESULT_KEY);
    }
  } catch {
    // Ignore storage failures so local validation still works in restricted browsers.
  }
}

function rowSetupSignature(source: ComparisonDataSource) {
  return [source.file_id, source.sheet_name, source.header_row, source.first_data_row].join("|");
}

function normalizeRowSetupConfirmation(next: ComparisonDataSource, previous?: ComparisonDataSource) {
  const setupUnchanged = previous ? rowSetupSignature(previous) === rowSetupSignature(next) : false;
  const requestedConfirmation = next.row_setup_confirmed ?? previous?.row_setup_confirmed ?? false;
  return {
    ...next,
    row_setup_confirmed: setupUnchanged ? Boolean(requestedConfirmation) : Boolean(!previous && next.row_setup_confirmed),
  };
}

interface WorkflowState {
  projectName: string;
  setProjectName: (value: string) => void;
  preset: PresetSelection;
  setPreset: (value: PresetSelection) => void;
  files: UploadedFile[];
  setFiles: (value: UploadedFile[]) => void;
  dataSources: ComparisonDataSource[];
  setDataSources: (value: ComparisonDataSource[]) => void;
  updateDataSource: (id: string, value: ComparisonDataSource) => void;
  removeDataSource: (id: string) => void;
  sourcePreviews: Record<string, DataSourcePreview>;
  setSourcePreview: (id: string, value: DataSourcePreview) => void;
  removeSourcePreview: (id: string) => void;
  rules: ComparisonRule[];
  setRules: (value: ComparisonRule[]) => void;
  updateRule: (id: string, value: ComparisonRule) => void;
  removeRule: (id: string) => void;
  result: ValidationResult | null;
  setResult: (value: ValidationResult | null) => void;
}

const Context = createContext<WorkflowState | null>(null);

export function WorkflowProvider({ children }: PropsWithChildren) {
  const [projectName, setProjectName] = useState("");
  const [preset, setPreset] = useState<PresetSelection>("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dataSources, setDataSourcesState] = useState<ComparisonDataSource[]>([]);
  const [sourcePreviews, setSourcePreviews] = useState<Record<string, DataSourcePreview>>({});
  const [rules, setRules] = useState<ComparisonRule[]>([]);
  const [result, setResultState] = useState<ValidationResult | null>(() => readStoredResult());

  const setDataSources = useCallback((value: ComparisonDataSource[]) => {
    setDataSourcesState((current) =>
      value.map((source) => normalizeRowSetupConfirmation(source, current.find((item) => item.id === source.id))),
    );
  }, []);

  const updateDataSource = useCallback((id: string, value: ComparisonDataSource) => {
    setDataSourcesState((current) =>
      current.map((item) => (item.id === id ? normalizeRowSetupConfirmation(value, item) : item)),
    );
  }, []);

  const removeDataSource = useCallback((id: string) => {
    setDataSourcesState((current) => current.filter((item) => item.id !== id));
  }, []);

  const setResult = useCallback((value: ValidationResult | null) => {
    setResultState(value);
    writeStoredResult(value);
  }, []);

  const value = useMemo(
    () => ({
      projectName,
      setProjectName,
      preset,
      setPreset,
      files,
      setFiles,
      dataSources,
      setDataSources,
      updateDataSource,
      removeDataSource,
      sourcePreviews,
      setSourcePreview: (id: string, value: DataSourcePreview) => setSourcePreviews((current) => ({ ...current, [id]: value })),
      removeSourcePreview: (id: string) =>
        setSourcePreviews((current) => {
          const next = { ...current };
          delete next[id];
          return next;
        }),
      rules,
      setRules,
      updateRule: (id: string, value: ComparisonRule) => setRules((current) => current.map((item) => (item.id === id ? value : item))),
      removeRule: (id: string) => setRules((current) => current.filter((item) => item.id !== id)),
      result,
      setResult,
    }),
    [projectName, preset, files, dataSources, setDataSources, updateDataSource, removeDataSource, sourcePreviews, rules, result, setResult],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useWorkflow() {
  const value = useContext(Context);
  if (!value) {
    throw new Error("WorkflowProvider is missing");
  }
  return value;
}
