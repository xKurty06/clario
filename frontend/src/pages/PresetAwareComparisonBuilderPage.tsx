import { useEffect, useMemo, useState } from "react";
import { ComparisonBuilderPage } from "./ComparisonBuilderPage";
import { RowSetupPage } from "./RowSetupPage";
import { useWorkflow } from "../features/files/WorkflowContext";
import type { UploadedFile } from "../types/file.types";
import type { ComparisonDataSource, PresetType } from "../types/validation.types";

const presetRoleLabels: Record<PresetType, string[]> = {
  reference_vs_copied: ["Reference", "Copied file"],
  reference_bidder_abstract: ["Reference", "Bidder", "Abstract"],
  generic_two_file: ["File A", "File B"],
  custom_comparison_builder: [],
};

function isConfigurablePreset(value: string): value is PresetType {
  return value === "reference_vs_copied" || value === "reference_bidder_abstract" || value === "generic_two_file";
}

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function sourceCount(files: UploadedFile[], preset: string) {
  if (isConfigurablePreset(preset)) return presetRoleLabels[preset].length;
  return Math.max(1, Math.min(3, files.length));
}

function sourceRoleName(preset: string, index: number) {
  return isConfigurablePreset(preset) ? presetRoleLabels[preset][index] : undefined;
}

function createDataSource(file: UploadedFile, index: number, preset: string): ComparisonDataSource {
  const sheet = file.sheets[0];
  const headerRow = sheet?.detected_header_row ?? 1;
  const roleName = sourceRoleName(preset, index);
  return {
    id: makeId("source"),
    name: `${roleName ?? `Source ${index + 1}`} - ${file.name}`,
    file_id: file.id,
    file_name: file.name,
    sheet_name: sheet?.name ?? "",
    header_row: headerRow,
    first_data_row: headerRow + 1,
    row_setup_confirmed: false,
    selected_row_numbers: [],
    ignored_row_numbers: [],
    row_selection_mode: "auto_detected",
    fields: [],
  };
}

function scaffoldSources(files: UploadedFile[], preset: string) {
  const count = sourceCount(files, preset);
  return Array.from({ length: count }, (_, index) => {
    const file = files[index] ?? files[0];
    return file ? createDataSource(file, index, preset) : null;
  }).filter((source): source is ComparisonDataSource => Boolean(source));
}

function closePresetBanner() {
  window.setTimeout(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const startManualButton = buttons.find((button) => button.textContent?.trim().includes("Start manually"));
    startManualButton?.click();
  }, 0);
}

export function PresetAwareComparisonBuilderPage() {
  const { files, preset, dataSources, setDataSources } = useWorkflow();
  const [reviewRowSetup, setReviewRowSetup] = useState(false);
  const rowSetupComplete = dataSources.length > 0 && dataSources.every((source) => source.row_setup_confirmed);

  const needsRowSetup = useMemo(
    () => files.length > 0 && (!dataSources.length || reviewRowSetup || !rowSetupComplete),
    [dataSources.length, files.length, reviewRowSetup, rowSetupComplete],
  );

  useEffect(() => {
    if (!files.length || dataSources.length) return;
    setDataSources(scaffoldSources(files, preset));
  }, [dataSources.length, files, preset, setDataSources]);

  useEffect(() => {
    if (!rowSetupComplete) return;
    setReviewRowSetup(false);
    closePresetBanner();
  }, [rowSetupComplete]);

  if (needsRowSetup) {
    return <RowSetupPage onContinue={() => setReviewRowSetup(false)} />;
  }

  return <ComparisonBuilderPage onBackToRowSetup={() => setReviewRowSetup(true)} />;
}
