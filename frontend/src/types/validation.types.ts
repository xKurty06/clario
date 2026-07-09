export type Severity = "low" | "medium" | "high";
export type ValidationStatus = "idle" | "running" | "complete" | "failed";
export type ComparisonMode = "reference_vs_copied" | "reference_bidder_abstract" | "generic_two_file";
export interface Discrepancy { issue_type: string; severity: Severity; source_file_name: string; reference_sheet?: string | null; reference_row?: number | null; comparison_sheet?: string | null; comparison_row?: number | null; reference_description?: string | null; comparison_description?: string | null; expected_value?: string | null; actual_value?: string | null; suggested_correction?: string | null; notes?: string | null; }
export interface ValidationResult { id: string; project_name: string; mode: ComparisonMode; created_at: string; total_rows: number; discrepancies: Discrepancy[]; breakdown: Record<string, number>; }
