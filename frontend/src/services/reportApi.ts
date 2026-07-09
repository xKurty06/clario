import type { ValidationResult } from "../types/validation.types";
import { apiBlob } from "./apiClient";
export const exportPdf = (result: ValidationResult) => apiBlob("/reports/pdf", result);
