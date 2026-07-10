import type { UploadedFile } from "../types/file.types";
import type { ComparisonDataSource, DataSourcePreview } from "../types/validation.types";
import { apiRequest } from "./apiClient";

export async function uploadFiles(files: File[]): Promise<UploadedFile[]> {
  const data = new FormData();
  files.forEach((file) => data.append("files", file));
  return apiRequest("/files/upload", { method: "POST", body: data });
}

export async function previewDataSource(dataSource: ComparisonDataSource): Promise<DataSourcePreview> {
  return apiRequest("/files/data-source-preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data_source: dataSource }),
  });
}

export async function inspectHeader(fileId: string, sheetName: string, headerRow: number): Promise<{ headers: string[]; sample_rows: Record<string, string | null>[] }> {
  return apiRequest("/files/inspect-header", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: fileId, sheet_name: sheetName, header_row: headerRow }),
  });
}
