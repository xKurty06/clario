import type { UploadedFile } from "../types/file.types";
import type { ComparisonDataSource, DataSourcePreview } from "../types/validation.types";
import { apiRequest } from "./apiClient";

const inFlightPreviewRequests = new Map<string, Promise<DataSourcePreview>>();

function previewRequestKey(dataSource: ComparisonDataSource) {
  return [
    dataSource.id,
    dataSource.file_id,
    dataSource.sheet_name,
    dataSource.header_row,
    dataSource.first_data_row,
    [...dataSource.selected_row_numbers].sort((left, right) => left - right).join(","),
    [...dataSource.ignored_row_numbers].sort((left, right) => left - right).join(","),
    dataSource.row_selection_mode,
  ].join("|");
}

export async function uploadFiles(files: File[]): Promise<UploadedFile[]> {
  const data = new FormData();
  files.forEach((file) => data.append("files", file));
  return apiRequest("/files/upload", { method: "POST", body: data });
}

export async function previewDataSource(dataSource: ComparisonDataSource): Promise<DataSourcePreview> {
  const requestKey = previewRequestKey(dataSource);
  const existingRequest = inFlightPreviewRequests.get(requestKey);
  if (existingRequest) return existingRequest;

  const request = apiRequest<DataSourcePreview>("/files/data-source-preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data_source: dataSource }),
  }).finally(() => {
    inFlightPreviewRequests.delete(requestKey);
  });

  inFlightPreviewRequests.set(requestKey, request);
  return request;
}

export async function inspectHeader(fileId: string, sheetName: string, headerRow: number): Promise<{ headers: string[]; sample_rows: Record<string, string | null>[] }> {
  return apiRequest("/files/inspect-header", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: fileId, sheet_name: sheetName, header_row: headerRow }),
  });
}
