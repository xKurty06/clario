export type FileRole = "reference" | "bidder" | "abstract" | "generic";
export interface TemplateSummary { id: string; name: string; fileRole: FileRole; }
export interface ColumnMapping { item_number?: string | null; quantity: string; unit?: string | null; description: string; unit_cost?: string | null; total_cost?: string | null; lot_group?: string | null; }
export interface MappingTemplate { id?: string | null; name: string; file_role: FileRole; included_sheets: string[]; ignored_sheets: string[]; sheet_pattern?: string | null; include_all_except_ignored: boolean; header_row: number; first_data_row: number; columns: ColumnMapping; ignored_terms: string[]; case_insensitive: boolean; }
