import { expect, test } from "@playwright/test";

const existingFile = { id: "file-existing", name: "existing.csv", extension: ".csv", size: 100, sheets: [] };
const newFile = { id: "file-new", name: "new.csv", extension: ".csv", size: 120, sheets: [] };

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

test("uploading a file after reopening a session persists it and exposes it to the builder", async ({ page }) => {
  const requests: string[] = [];

  await page.route(/http:\/\/(127\.0\.0\.1|localhost):8765\/api\/v1\/validation\/recent$/, async (route) => {
    await route.fulfill({ status: 200, json: [{ id: "session-lifecycle", project_name: "Lifecycle session", mode: "custom_comparison_builder", file_names: [existingFile.name], discrepancy_count: 0, created_at: restoredResult.created_at, can_continue_setup: true }] });
  });
  await page.route(/http:\/\/(127\.0\.0\.1|localhost):8765\/api\/v1\/validation\/sessions\/session-lifecycle$/, async (route) => {
    await route.fulfill({ status: 200, json: { result: restoredResult, request: { project_name: restoredResult.project_name, preset: "custom_comparison_builder", data_sources: [], rules: [] }, files: [existingFile] } });
  });
  await page.route(/http:\/\/(127\.0\.0\.1|localhost):8765\/api\/v1\/files\/upload$/, async (route) => {
    requests.push("upload");
    await route.fulfill({ status: 200, json: [newFile] });
  });
  await page.route(/http:\/\/(127\.0\.0\.1|localhost):8765\/api\/v1\/validation\/sessions\/session-lifecycle\/files$/, async (route) => {
    requests.push(`persist:${route.request().postDataJSON().file_id}`);
    await route.fulfill({ status: 201, json: { id: newFile.id, name: newFile.name, path: `/sessions/Lifecycle session/uploads/${newFile.id}.csv`, size: newFile.size } });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Continue setup" }).first().click();
  await expect(page).toHaveURL(/\/mapping/);
  await page.goto("/upload");
  await page.locator('input[type="file"]').setInputFiles({ name: newFile.name, mimeType: "text/csv", buffer: Buffer.from("Item,Quantity\nPen,5\n") });
  await page.getByRole("button", { name: "Continue to validation" }).click();
  await expect(page).toHaveURL(/\/mapping/);
  await expect(page.getByText(newFile.name)).toBeVisible();
  expect(requests).toEqual(["upload", `persist:${newFile.id}`]);
});
