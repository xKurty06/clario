import { appConfig } from "../app/config";
import type { ValidationResult } from "../types/validation.types";
import { apiBlobWithHeaders } from "./apiClient";

export interface ExportedPdfReport {
  blob: Blob;
  filename: string;
  savedPath: string | null;
  openUrl: string;
  downloadUrl: string;
}

function filenameFromDisposition(disposition: string | null) {
  if (!disposition) return null;
  const encodedMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (encodedMatch?.[1]) return decodeURIComponent(encodedMatch[1].replace(/"/g, ""));
  const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
  return plainMatch?.[1] ?? null;
}

function fallbackReportFileName(projectName: string) {
  const safeName = projectName.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
  return `${safeName || "validation"}-comparison-report.pdf`;
}

function reportUrl(resultId: string, download = false) {
  const encodedId = encodeURIComponent(resultId);
  const suffix = download ? "?download=true" : "";
  return `${appConfig.apiBaseUrl}/reports/${encodedId}/pdf${suffix}`;
}

export async function exportPdf(result: ValidationResult): Promise<ExportedPdfReport> {
  const response = await apiBlobWithHeaders("/reports/pdf", result);
  return {
    blob: response.blob,
    filename: filenameFromDisposition(response.headers.get("Content-Disposition")) ?? fallbackReportFileName(result.project_name),
    savedPath: response.headers.get("X-Report-Path"),
    openUrl: reportUrl(result.id),
    downloadUrl: reportUrl(result.id, true),
  };
}
