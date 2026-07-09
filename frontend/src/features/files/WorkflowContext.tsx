import { createContext, useContext, useMemo, useState, type PropsWithChildren } from "react";
import type { UploadedFile } from "../../types/file.types";
import type { ExtractedRow } from "../../types/row.types";
import type { MappingTemplate } from "../../types/template.types";
import type { ComparisonMode, ValidationResult } from "../../types/validation.types";

interface WorkflowState {
  projectName: string; setProjectName: (value: string) => void;
  mode: ComparisonMode; setMode: (value: ComparisonMode) => void;
  files: UploadedFile[]; setFiles: (value: UploadedFile[]) => void;
  templates: Record<string, MappingTemplate>; setTemplate: (fileId: string, value: MappingTemplate) => void;
  rows: Record<string, ExtractedRow[]>; setRows: (fileId: string, value: ExtractedRow[]) => void;
  result: ValidationResult | null; setResult: (value: ValidationResult | null) => void;
}
const Context = createContext<WorkflowState | null>(null);
export function WorkflowProvider({ children }: PropsWithChildren) {
  const [projectName, setProjectName] = useState("New procurement review"); const [mode, setMode] = useState<ComparisonMode>("reference_vs_copied");
  const [files, setFiles] = useState<UploadedFile[]>([]); const [templates, setTemplates] = useState<Record<string, MappingTemplate>>({});
  const [rows, setRowState] = useState<Record<string, ExtractedRow[]>>({}); const [result, setResult] = useState<ValidationResult | null>(null);
  const value = useMemo(() => ({ projectName,setProjectName,mode,setMode,files,setFiles,templates,setTemplate:(id:string,v:MappingTemplate)=>setTemplates(p=>({...p,[id]:v})),rows,setRows:(id:string,v:ExtractedRow[])=>setRowState(p=>({...p,[id]:v})),result,setResult }), [projectName,mode,files,templates,rows,result]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useWorkflow() { const value=useContext(Context); if(!value) throw new Error("WorkflowProvider is missing"); return value; }
