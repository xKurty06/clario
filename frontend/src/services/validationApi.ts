import { buildPreflightReview, preflightErrorMessage } from "../features/validation/preflightReview";
import type { ComparisonDataSource, ComparisonRule, DataSourcePreview, PresetType, ValidationResult } from "../types/validation.types";
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
  file_names: string;
  discrepancy_count: number;
  created_at: string;
}

export const listRecentSessions = () => apiRequest<RecentSession[]>("/validation/recent");
