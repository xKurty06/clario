import type { ComparisonDataSource, ComparisonRule, PresetType, ValidationResult } from "../types/validation.types";
import { apiRequest } from "./apiClient";

export interface ValidationPayload {
  project_name: string;
  preset: PresetType;
  data_sources: ComparisonDataSource[];
  rules: ComparisonRule[];
}

export const runValidation = (payload: ValidationPayload) =>
  apiRequest<ValidationResult>("/validation/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export interface RecentSession {
  id: string;
  project_name: string;
  mode: PresetType;
  file_names: string;
  discrepancy_count: number;
  created_at: string;
}

export const listRecentSessions = () => apiRequest<RecentSession[]>("/validation/recent");
