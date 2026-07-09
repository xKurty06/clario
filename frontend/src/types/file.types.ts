export type SupportedFileExtension = ".xlsx" | ".xls" | ".csv";
export interface LocalFileMetadata { id: string; name: string; extension: SupportedFileExtension; size: number; }
export interface SheetInfo { name: string; row_count: number; column_count: number; detected_header_row: number; headers: string[]; sample_rows: Record<string, string | null>[]; }
export interface UploadedFile extends LocalFileMetadata { sheets: SheetInfo[]; }
