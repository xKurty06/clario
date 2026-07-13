import { buildPreflightReview, preflightErrorMessage } from "../features/validation/preflightReview";
import type { ComparisonDataSource, ComparisonRule, PresetType, ValidationResult } from "../types/validation.types";
import { apiRequest } from "./apiClient";

export interface ValidationPayload {
  project_name: string;
  preset: PresetType;
  data_sources: ComparisonDataSource[];
  rules: ComparisonRule[];
}

export const runValidation = (payload: ValidationPayload) => {
  const review = buildPreflightReview({
    projectName: payload.project_name,
    preset: payload.preset,
    fileCount: new Set(payload.data_sources.map((source) => source.file_id).filter(Boolean)).size,
    dataSources: payload.data_sources,
    rules: payload.rules,
  });

  if (!review.canRun) {
    throw new Error(preflightErrorMessage(review));
  }

  return apiRequest<ValidationResult>("/validation/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
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
