import type { UploadedFile } from "../types/file.types";
import type { ExtractedRow } from "../types/row.types";
import type { MappingTemplate } from "../types/template.types";
import { apiRequest } from "./apiClient";

export async function uploadFiles(files: File[]): Promise<UploadedFile[]> {
  const data = new FormData(); files.forEach((file) => data.append("files", file));
  return apiRequest("/files/upload", { method: "POST", body: data });
}
export async function previewRows(fileId: string, template: MappingTemplate): Promise<{ rows: ExtractedRow[]; total: number }> {
  return apiRequest("/files/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file_id: fileId, template }) });
}
export async function inspectHeader(fileId: string, sheetName: string, headerRow: number): Promise<{ headers: string[]; sample_rows: Record<string, string | null>[] }> {
  return apiRequest("/files/inspect-header", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file_id: fileId, sheet_name: sheetName, header_row: headerRow }) });
}
