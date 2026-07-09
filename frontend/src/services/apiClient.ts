import { appConfig } from "../app/config";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${appConfig.apiBaseUrl}${path}`, {
    ...init,
    headers: { Accept: "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { code?: string; detail?: string };
    throw new ApiError(response.status, body.code ?? "API_ERROR", body.detail ?? "The local service could not complete the request.");
  }
  return response.json() as Promise<T>;
}

export async function apiBlob(path: string, body: unknown): Promise<Blob> {
  const response = await fetch(`${appConfig.apiBaseUrl}${path}`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/pdf" }, body: JSON.stringify(body) });
  if (!response.ok) throw new ApiError(response.status, "REPORT_ERROR", "The local PDF service could not create the report.");
  return response.blob();
}
