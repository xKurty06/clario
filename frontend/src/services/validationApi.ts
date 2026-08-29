import { buildPreflightReview, preflightErrorMessage } from "../features/validation/preflightReview";
import type { ComparisonDataSource, ComparisonRule, DataSourcePreview, PresetType, ValidationResult } from "../types/validation.types";
import type { UploadedFile } from "../types/file.types";
import { apiRequest } from "./apiClient";

export interface ValidationPayload {
  project_name: string;
  preset: PresetType;
  data_sources: ComparisonDataSource[];
  rules: ComparisonRule[];
  source_previews?: Record<string, DataSourcePreview | undefined>;
}

export const runValidation = (payload: ValidationPayload) => {
  const review = buildPreflightReview({
    projectName: payload.project_name,
    preset: payload.preset,
    fileCount: new Set(payload.data_sources.map((source) => source.file_id).filter(Boolean)).size,
    dataSources: payload.data_sources,
    rules: payload.rules,
    sourcePreviews: payload.source_previews,
  });

  if (!review.canRun) {
    throw new Error(preflightErrorMessage(review));
  }

  return apiRequest<ValidationResult>("/validation/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project_name: payload.project_name,
      preset: payload.preset,
      data_sources: payload.data_sources,
      rules: payload.rules,
    }),
  });
};

export interface RecentSession {
  id: string;
  project_name: string;
  mode: PresetType;
  file_names: string[];
  discrepancy_count: number;
  created_at: string;
  has_report?: boolean;
  latest_report_filename?: string | null;
  can_reopen?: boolean;
  can_continue_setup?: boolean;
}

export interface SessionState {
  result: ValidationResult;
  request: ValidationPayload | null;
  files: UploadedFile[];
}

export const listRecentSessions = () => apiRequest<RecentSession[]>("/validation/recent");

export const createSessionDraft = (payload: { project_name: string; preset?: string; file_names?: string[]; uploaded_file_ids?: string[] }) =>
  apiRequest<{ id: string; project_name: string; status: string }>("/validation/sessions/draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const getSessionState = (sessionId: string) => apiRequest<SessionState>(`/validation/sessions/${encodeURIComponent(sessionId)}`);

export const renameSession = (sessionId: string, projectName: string) =>
  apiRequest<{ status: string; project_name: string }>(`/validation/sessions/${encodeURIComponent(sessionId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_name: projectName }),
  });

export const deleteSession = (sessionId: string) =>
  apiRequest<void>(`/validation/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
