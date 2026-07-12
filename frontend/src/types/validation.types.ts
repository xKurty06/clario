export type FieldType = "text" | "number" | "currency" | "date" | "boolean" | "raw";
export type Severity = "low" | "medium" | "high";
export type PresetType = "reference_vs_copied" | "reference_bidder_abstract" | "generic_two_file" | "custom_comparison_builder";
export type PresetSelection = PresetType | "";
export type RowSelectionMode = "auto_detected" | "manual_include" | "manual_exclude";
export type RuleType = "compare_values" | "formula_check" | "required_field_check" | "duplicate_check";
export type MatchStrategy = "by_row_order" | "by_item_number_field" | "by_exact_text_field" | "by_multiple_fields" | "manual_placeholder";
export type RuleStrictness = "exact" | "normalized_exact" | "numeric_tolerance" | "currency_tolerance";

export interface NormalizationSettings {
  case_insensitive: boolean;
  trim_whitespace: boolean;
  collapse_whitespace: boolean;
}

export interface ComparisonField {
  id: string;
  data_source_id: string;
  field_name: string;
  field_type: FieldType;
  column_letter: string;
  original_header_label?: string | null;
  custom_display_name?: string | null;
  required: boolean;
  normalization: NormalizationSettings;
}

export interface ComparisonDataSource {
  id: string;
  name: string;
  file_id: string;
  file_name?: string | null;
  sheet_name: string;
  header_row: number;
  first_data_row: number;
  row_setup_confirmed?: boolean;
  selected_row_numbers: number[];
  ignored_row_numbers: number[];
  row_selection_mode: RowSelectionMode;
  fields: ComparisonField[];
}

export interface ColumnReference {
  index: number;
  letter: string;
  header_label: string;
  display_label: string;
}

export interface PreviewRow {
  row_number: number;
  selected: boolean;
  ignored: boolean;
  cells: Record<string, string | number | boolean | null>;
}

export interface DataSourcePreview {
  data_source: ComparisonDataSource;
  columns: ColumnReference[];
  rows: PreviewRow[];
  total_rows: number;
  detected_selected_rows: number[];
}

export interface FormulaSettings {
  operator: "add" | "subtract" | "multiply" | "divide";
  operand_field_ids: string[];
  result_field_id: string;
}

export interface ComparisonRule {
  id: string;
  rule_name: string;
  rule_type: RuleType;
  left_data_source_id?: string | null;
  left_field_id?: string | null;
  right_data_source_id?: string | null;
  right_field_id?: string | null;
  left_match_field_ids: string[];
  right_match_field_ids: string[];
  match_strategy: MatchStrategy;
  strictness: RuleStrictness;
  numeric_tolerance?: string | null;
  currency_tolerance?: string | null;
  formula_settings?: FormulaSettings | null;
  severity: Severity;
  enabled: boolean;
}

export interface ExtractedFieldValue {
  field_id: string;
  field_name: string;
  display_name: string;
  field_type: FieldType;
  column_letter: string;
  original_header_label?: string | null;
  raw_value?: string | number | boolean | null;
  normalized_value?: string | number | boolean | null;
}

export interface ExtractedRecord {
  source_file_id: string;
  source_file_name: string;
  data_source_id: string;
  data_source_name: string;
  sheet_name: string;
  excel_row_number: number;
  field_values: Record<string, ExtractedFieldValue>;
  raw_row: Record<string, string | number | boolean | null>;
  extraction_issues: string[];
}

export interface RuleSummary {
  rule_id: string;
  rule_name: string;
  rule_type: RuleType;
  severity: Severity;
  discrepancy_count: number;
}

export interface RuleDiscrepancy {
  rule_id: string;
  rule_name: string;
  rule_type: RuleType;
  severity: Severity;
  left_file_name?: string | null;
  left_sheet_name?: string | null;
  left_row_number?: number | null;
  left_field_name?: string | null;
  right_file_name?: string | null;
  right_sheet_name?: string | null;
  right_row_number?: number | null;
  right_field_name?: string | null;
  expected_value?: string | null;
  actual_value?: string | null;
  suggested_correction?: string | null;
  notes?: string | null;
}

export interface ValidationResult {
  id: string;
  project_name: string;
  preset: PresetType;
  created_at: string;
  file_names: string[];
  total_selected_rows: number;
  data_sources: ComparisonDataSource[];
  extracted_records: ExtractedRecord[];
  rule_summaries: RuleSummary[];
  discrepancies: RuleDiscrepancy[];
  breakdown: Record<string, number>;
}
