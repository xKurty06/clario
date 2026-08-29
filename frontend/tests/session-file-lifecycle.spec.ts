import { expect, test } from "@playwright/test";

const sheet = {
  name: "Sheet1",
  row_count: 2,
  column_count: 2,
  detected_header_row: 1,
  headers: ["Item", "Quantity"],
  sample_rows: [{ Item: "Bond Paper", Quantity: "10" }],
};
const existingFile = { id: "file-existing", name: "existing.csv", extension: ".csv", size: 100, sheets: [sheet] };
const newFile = { id: "file-new", name: "new.csv", extension: ".csv", size: 120, sheets: [sheet] };

const restoredResult = {
  id: "session-lifecycle",
  project_name: "Lifecycle session",
  preset: "custom_comparison_builder",
  created_at: "2026-01-01T00:00:00Z",
  file_names: [existingFile.name],
  total_selected_rows: 0,
  data_sources: [],
  extracted_records: [],
  rule_summaries: [],
  discrepancies: [],
  breakdown: { high: 0, medium: 0, low: 0 },
};

function previewForSource(source: { id: string; file_id: string; file_name?: string | null; name: string }) {
  return {
    data_source: {
      ...source,
      sheet_name: "Sheet1",
      header_row: 1,
      first_data_row: 2,
      selected_row_numbers: [2],
      ignored_row_numbers: [1],
      row_selection_mode: "auto_detected",
      fields: [],
    },
    columns: [
      { index: 0, letter: "A", header_label: "Item", display_label: "A - Item" },
      { index: 1, letter: "B", header_label: "Quantity", display_label: "B - Quantity" },
    ],
    rows: [
      { row_number: 1, selected: false, ignored: true, cells: { Item: "Item", Quantity: "Quantity" } },
      { row_number: 2, selected: true, ignored: false, cells: { Item: "Bond Paper", Quantity: "10" } },
    ],
    total_rows: 2,
    detected_selected_rows: [2],
  };
}

test("uploading a file after reopening a session persists it and exposes it to the builder", async ({ page }) => {
  const requests: string[] = [];
  const apiNotFoundResponses: string[] = [];
  const currentFiles = [existingFile];

  page.on("response", (response) => {
    if (response.url().includes("/api/v1/") && response.status() === 404) {
      apiNotFoundResponses.push(response.url());
    }
  });

  await page.route(/http:\/\/(127\.0\.0\.1|localhost):876[56]\/health$/, async (route) => {
    await route.fulfill({ status: 200, json: { status: "ok" } });
  });

  await page.route(/http:\/\/(127\.0\.0\.1|localhost):876[56]\/api\/v1\/validation\/recent$/, async (route) => {
    await route.fulfill({
      status: 200,
      json: [{
        id: "session-lifecycle",
        project_name: "Lifecycle session",
        mode: "custom_comparison_builder",
        file_names: currentFiles.map((file) => file.name),
        discrepancy_count: 0,
        created_at: restoredResult.created_at,
        can_continue_setup: true,
      }],
    });
  });
  await page.route(/http:\/\/(127\.0\.0\.1|localhost):876[56]\/api\/v1\/validation\/sessions\/session-lifecycle$/, async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        result: {
          ...restoredResult,
          file_names: currentFiles.map((file) => file.name),
        },
        request: { project_name: restoredResult.project_name, preset: "custom_comparison_builder", data_sources: [], rules: [] },
        files: currentFiles,
      },
    });
  });
  await page.route(/http:\/\/(127\.0\.0\.1|localhost):876[56]\/api\/v1\/files\/upload$/, async (route) => {
    requests.push("upload");
    await route.fulfill({ status: 200, json: [newFile] });
  });
  await page.route(/http:\/\/(127\.0\.0\.1|localhost):876[56]\/api\/v1\/files\/data-source-preview$/, async (route) => {
    const payload = route.request().postDataJSON() as { data_source: { id: string; file_id: string; file_name?: string | null; name: string } };
    await route.fulfill({ status: 200, json: previewForSource(payload.data_source) });
  });
  await page.route(/http:\/\/(127\.0\.0\.1|localhost):876[56]\/api\/v1\/validation\/sessions\/session-lifecycle\/files$/, async (route) => {
    const fileId = route.request().postDataJSON().file_id;
    requests.push(`persist:${fileId}`);
    if (!currentFiles.some((file) => file.id === fileId)) currentFiles.push(newFile);
    await route.fulfill({ status: 201, json: { id: newFile.id, name: newFile.name, path: `/sessions/Lifecycle session/uploads/${newFile.id}.csv`, size: newFile.size } });
  });
  await page.route(/http:\/\/(127\.0\.0\.1|localhost):876[56]\/api\/v1\/validation\/sessions\/draft$/, async (route) => {
    requests.push("draft");
    await route.fulfill({ status: 500, json: { detail: "Unexpected draft creation." } });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Continue setup" }).first().click();
  await expect(page).toHaveURL(/\/mapping/);
  await expect(page.getByRole("heading", { name: "Confirm row setup" })).toBeVisible();
  await expect(page.getByRole("heading", { name: `Source 1 - ${existingFile.name}` })).toHaveCount(1);
  await page.getByRole("link", { name: "Upload files" }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: newFile.name, mimeType: "text/csv", buffer: Buffer.from("Item,Quantity\nPen,5\n") });
  await page.getByRole("button", { name: "Continue to validation" }).click();
  await expect(page).toHaveURL(/\/mapping/);
  await expect(page.getByRole("heading", { name: "Confirm row setup" })).toBeVisible();
  await expect(page.getByRole("heading", { name: `Source 1 - ${existingFile.name}` })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: `Source 2 - ${newFile.name}` })).toHaveCount(1);
  await page.getByRole("button", { name: "Confirm all previewed" }).first().click();
  await page.getByRole("button", { name: "Continue to comparison builder" }).first().click();
  await expect(page).toHaveURL(/\/builder/);
  await expect(page.getByRole("heading", { name: `Source 1 - ${existingFile.name}` })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: `Source 2 - ${newFile.name}` })).toHaveCount(1);

  await page.getByRole("link", { name: "Upload files" }).click();
  await page.getByRole("button", { name: "Continue to validation" }).click();
  await expect(page).toHaveURL(/\/mapping/);
  await expect(page.getByRole("heading", { name: `Source 1 - ${existingFile.name}` })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: `Source 2 - ${newFile.name}` })).toHaveCount(1);
  await page.getByRole("button", { name: "Confirm all previewed" }).first().click();
  await page.getByRole("button", { name: "Continue to comparison builder" }).first().click();
  await expect(page).toHaveURL(/\/builder/);
  await expect(page.getByRole("heading", { name: `Source 1 - ${existingFile.name}` })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: `Source 2 - ${newFile.name}` })).toHaveCount(1);

  await page.getByLabel(/Return to sessions from Lifecycle session/).click();
  await page.getByText("Lifecycle session").click();
  await expect(page).toHaveURL(/\/mapping/);
  await expect(page.getByRole("heading", { name: `Source 1 - ${existingFile.name}` })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: `Source 2 - ${newFile.name}` })).toHaveCount(1);
  await page.getByRole("button", { name: "Confirm all previewed" }).first().click();
  await page.getByRole("button", { name: "Continue to comparison builder" }).first().click();
  await expect(page).toHaveURL(/\/builder/);
  await expect(page.getByRole("heading", { name: `Source 1 - ${existingFile.name}` })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: `Source 2 - ${newFile.name}` })).toHaveCount(1);

  expect(requests).toEqual(["upload", `persist:${newFile.id}`]);
  expect(currentFiles.map((file) => file.id)).toEqual([existingFile.id, newFile.id]);
  expect(apiNotFoundResponses).toEqual([]);
});
