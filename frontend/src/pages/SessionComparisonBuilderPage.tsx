import { useEffect } from "react";
import { ComparisonBuilderPage } from "./ComparisonBuilderPage";
import { useWorkflow } from "../features/files/WorkflowContext";
import type { ComparisonDataSource } from "../types/validation.types";

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function sourceForFile(file: { id: string; name: string; sheets: Array<{ name: string; detected_header_row?: number | null }> }, index: number): ComparisonDataSource {
  const sheet = file.sheets[0];
  const headerRow = sheet?.detected_header_row ?? 1;
  return {
    id: makeId("source"),
    name: `Source ${index + 1} - ${file.name}`,
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

export function SessionComparisonBuilderPage() {
  const { files, dataSources, setDataSources, removeSourcePreview } = useWorkflow();

  useEffect(() => {
    if (!files.length) return;
    const knownFileIds = new Set(dataSources.map((source) => source.file_id));
    const additions = files.filter((file) => !knownFileIds.has(file.id)).map((file, index) => sourceForFile(file, dataSources.length + index));
    if (!additions.length) return;
    setDataSources([...dataSources, ...additions]);
    additions.forEach((source) => removeSourcePreview(source.id));
  }, [files, dataSources, setDataSources, removeSourcePreview]);

  return <ComparisonBuilderPage />;
}
