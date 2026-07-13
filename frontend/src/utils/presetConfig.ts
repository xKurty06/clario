import type { PresetSelection, PresetType } from "../types/validation.types";

export type ConfigurablePresetType = Exclude<PresetType, "custom_comparison_builder">;

export const presetRoles: Record<PresetType, string[]> = {
  reference_vs_copied: ["Reference", "Copied file"],
  reference_bidder_abstract: ["Reference", "Bidder", "Abstract"],
  generic_two_file: ["File A", "File B"],
  custom_comparison_builder: [],
};

export const presetSelectOptions: Array<{ value: PresetSelection; label: string; description: string }> = [
  { value: "", label: "Choose a comparison preset", description: "Required before continuing." },
  { value: "reference_vs_copied", label: "Reference vs Copied File", description: "Two sources with standard description and quantity checks." },
  { value: "reference_bidder_abstract", label: "Reference + Bidder + Abstract", description: "Three sources with procurement-oriented formula checks." },
  { value: "generic_two_file", label: "Generic Two-File Comparison", description: "Two flexible sources for arbitrary field-to-field checks." },
  { value: "custom_comparison_builder", label: "Custom Comparison Builder", description: "Start empty and define your own sources, fields, and rules." },
];

export function isPresetType(value: string): value is PresetType {
  return value === "reference_vs_copied" || value === "reference_bidder_abstract" || value === "generic_two_file" || value === "custom_comparison_builder";
}

export function isConfigurablePreset(value: string): value is ConfigurablePresetType {
  return value === "reference_vs_copied" || value === "reference_bidder_abstract" || value === "generic_two_file";
}

export function rolesForPreset(value: string) {
  return isConfigurablePreset(value) ? presetRoles[value] : [];
}
