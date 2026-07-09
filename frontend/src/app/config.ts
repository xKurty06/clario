export const appConfig = {
  displayName: "Procurement Validator",
  packageName: "procurement-validator",
  version: "0.1.0",
  apiBaseUrl:
    import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8765/api/v1",
} as const;

