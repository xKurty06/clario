import { createContext, useContext, useMemo, useState, type PropsWithChildren } from "react";
import type { UploadedFile } from "../../types/file.types";
import type {
  ComparisonDataSource,
  ComparisonRule,
  DataSourcePreview,
  PresetType,
  ValidationResult,
} from "../../types/validation.types";

interface WorkflowState {
  projectName: string;
  setProjectName: (value: string) => void;
  preset: PresetType;
  setPreset: (value: PresetType) => void;
  files: UploadedFile[];
  setFiles: (value: UploadedFile[]) => void;
  dataSources: ComparisonDataSource[];
  setDataSources: (value: ComparisonDataSource[]) => void;
  updateDataSource: (id: string, value: ComparisonDataSource) => void;
  removeDataSource: (id: string) => void;
  sourcePreviews: Record<string, DataSourcePreview>;
  setSourcePreview: (id: string, value: DataSourcePreview) => void;
  rules: ComparisonRule[];
  setRules: (value: ComparisonRule[]) => void;
  updateRule: (id: string, value: ComparisonRule) => void;
  removeRule: (id: string) => void;
  result: ValidationResult | null;
  setResult: (value: ValidationResult | null) => void;
}

const Context = createContext<WorkflowState | null>(null);

export function WorkflowProvider({ children }: PropsWithChildren) {
  const [projectName, setProjectName] = useState("New procurement review");
  const [preset, setPreset] = useState<PresetType>("reference_vs_copied");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dataSources, setDataSources] = useState<ComparisonDataSource[]>([]);
  const [sourcePreviews, setSourcePreviews] = useState<Record<string, DataSourcePreview>>({});
  const [rules, setRules] = useState<ComparisonRule[]>([]);
  const [result, setResult] = useState<ValidationResult | null>(null);

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
      updateDataSource: (id: string, value: ComparisonDataSource) => setDataSources((current) => current.map((item) => (item.id === id ? value : item))),
      removeDataSource: (id: string) => setDataSources((current) => current.filter((item) => item.id !== id)),
      sourcePreviews,
      setSourcePreview: (id: string, value: DataSourcePreview) => setSourcePreviews((current) => ({ ...current, [id]: value })),
      rules,
      setRules,
      updateRule: (id: string, value: ComparisonRule) => setRules((current) => current.map((item) => (item.id === id ? value : item))),
      removeRule: (id: string) => setRules((current) => current.filter((item) => item.id !== id)),
      result,
      setResult,
    }),
    [projectName, preset, files, dataSources, sourcePreviews, rules, result],
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
