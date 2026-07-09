import type { MappingTemplate } from "../types/template.types";
import { apiRequest } from "./apiClient";
export const listTemplates = () => apiRequest<MappingTemplate[]>("/templates");
export const saveTemplate = (template: MappingTemplate) => apiRequest<MappingTemplate>("/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(template) });
export const duplicateTemplate = (id: string) => apiRequest<MappingTemplate>(`/templates/${id}/duplicate`, { method: "POST" });
export const deleteTemplate = (id: string) => apiRequest<void>(`/templates/${id}`, { method: "DELETE" });
