import { appConfig } from "../app/config";

const BACKEND_UNREACHABLE_MESSAGE = "The local backend service is not reachable. Please make sure the backend is running on 127.0.0.1:8765.";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface ApiBlobResponse {
  blob: Blob;
  headers: Headers;
}

function backendRootUrl() {
  return appConfig.apiBaseUrl.replace(/\/api\/v\d+\/?$/, "");
}

function alternateLoopbackUrl(input: string) {
  if (input.includes("http://127.0.0.1:8765")) return input.replace("http://127.0.0.1:8765", "http://localhost:8765");
  if (input.includes("http://localhost:8765")) return input.replace("http://localhost:8765", "http://127.0.0.1:8765");
  return null;
}

function unreachableMessage(url: string, fallbackUrl: string | null, cause: unknown) {
  const detail = cause instanceof Error && cause.message ? ` ${cause.message}` : "";
  const tried = fallbackUrl ? ` Tried ${url} and ${fallbackUrl}.` : ` Tried ${url}.`;
  return `${BACKEND_UNREACHABLE_MESSAGE}${tried}${detail}`;
}

async function fetchLocal(input: string, init?: RequestInit) {
  const fallbackUrl = alternateLoopbackUrl(input);
  let firstCause: unknown;

  try {
    return await fetch(input, init);
  } catch (cause) {
    firstCause = cause;
  }

  if (fallbackUrl) {
    try {
      return await fetch(fallbackUrl, init);
    } catch {
      // Preserve the first failure because it points at the configured API URL.
    }
  }

  throw new ApiError(0, "BACKEND_UNREACHABLE", unreachableMessage(input, fallbackUrl, firstCause));
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetchLocal(`${appConfig.apiBaseUrl}${path}`, {
    ...init,
    headers: { Accept: "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { code?: string; detail?: string };
    throw new ApiError(response.status, body.code ?? "API_ERROR", body.detail ?? "The local service could not complete the request.");
  }
  return response.json() as Promise<T>;
}

export async function apiBlobWithHeaders(path: string, body: unknown): Promise<ApiBlobResponse> {
  const response = await fetchLocal(`${appConfig.apiBaseUrl}${path}`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/pdf" }, body: JSON.stringify(body) });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { code?: string; detail?: string };
    throw new ApiError(response.status, body.code ?? "REPORT_ERROR", body.detail ?? "The local PDF service could not create the report.");
  }
  return { blob: await response.blob(), headers: response.headers };
}

export async function apiBlob(path: string, body: unknown): Promise<Blob> {
  return (await apiBlobWithHeaders(path, body)).blob;
}

export async function checkBackendHealth(): Promise<void> {
  const response = await fetchLocal(`${backendRootUrl()}/health`, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new ApiError(response.status, "BACKEND_HEALTH_FAILED", BACKEND_UNREACHABLE_MESSAGE);
  }
}
