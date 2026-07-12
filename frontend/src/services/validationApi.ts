import type { ComparisonDataSource, ComparisonRule, PresetType, ValidationResult } from "../types/validation.types";
import { apiRequest } from "./apiClient";

export interface ValidationPayload {
  project_name: string;
  preset: PresetType;
  data_sources: ComparisonDataSource[];
  rules: ComparisonRule[];
}

function unconfirmedSourceNames(dataSources: ComparisonDataSource[]) {
  return dataSources.filter((source) => !source.row_setup_confirmed).map((source) => source.name);
}

export const runValidation = (payload: ValidationPayload) => {
  const unconfirmed = unconfirmedSourceNames(payload.data_sources);
  if (unconfirmed.length) {
    const names = unconfirmed.slice(0, 3).join(", ");
    const suffix = unconfirmed.length > 3 ? ` and ${unconfirmed.length - 3} more` : "";
    throw new Error(`Confirm the header row and first data row for ${names}${suffix} before running validation.`);
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
