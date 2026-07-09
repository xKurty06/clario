import type { ExtractedRow } from "../types/row.types";
import type { ComparisonMode, ValidationResult } from "../types/validation.types";
import { apiRequest } from "./apiClient";
export interface ValidationPayload { project_name: string; mode: ComparisonMode; reference_rows: ExtractedRow[]; comparison_rows: ExtractedRow[]; bidder_rows: ExtractedRow[]; abstract_rows: ExtractedRow[]; compare_fields: string[]; case_insensitive: boolean; }
export const runValidation = (payload: ValidationPayload) => apiRequest<ValidationResult>("/validation/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
export interface RecentSession { id: string; project_name: string; mode: ComparisonMode; file_names: string; discrepancy_count: number; created_at: string; }
export const listRecentSessions = () => apiRequest<RecentSession[]>("/validation/recent");
