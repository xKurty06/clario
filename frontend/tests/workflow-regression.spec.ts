import { expect, test, type Page } from "@playwright/test";
import type { ComparisonDataSource, DataSourcePreview, ValidationResult } from "../src/types/validation.types";
import type { UploadedFile } from "../src/types/file.types";

const uploadedFiles: UploadedFile[] = [
  {
    id: "file-reference",
    name: "reference-master.csv",
    extension: ".csv",
    size: 84,
    sheets: [
      {
        name: "Sheet1",
        row_count: 3,
        column_count: 2,
        detected_header_row: 1,
        headers: ["Item Description", "Quantity"],
        sample_rows: [
          { "Item Description": "Bond Paper", Quantity: "10" },
          { "Item Description": "Ballpen", Quantity: "5" },
        ],
      },
    ],
  },
  {
    id: "file-copied",
    name: "copied-check.csv",
    extension: ".csv",
    size: 82,
    sheets: [
      {
        name: "Sheet1",
        row_count: 3,
        column_count: 2,
        detected_header_row: 1,
        headers: ["Item Description", "Quantity"],
        sample_rows: [
          { "Item Description": "Bond Paper", Quantity: "10" },
          { "Item Description": "Ballpen", Quantity: "5" },
        ],
      },
    ],
  },
];

function previewForSource(source: ComparisonDataSource): DataSourcePreview {
  return {
    data_source: {
      ...source,
      selected_row_numbers: [2, 3],
      ignored_row_numbers: [1],
      row_selection_mode: "auto_detected",
    },
    columns: [
      { index: 0, letter: "A", header_label: "Item Description", display_label: "A - Item Description" },
      { index: 1, letter: "B", header_label: "Quantity", display_label: "B - Quantity" },
    ],
    rows: [
      {
        row_number: 1,
        selected: false,
        ignored: true,
        cells: { "Item Description": "Item Description", Quantity: "Quantity" },
      },
      {
        row_number: 2,
        selected: true,
        ignored: false,
        cells: { "Item Description": "Bond Paper", Quantity: "10" },
      },
      {
        row_number: 3,
        selected: true,
        ignored: false,
        cells: { "Item Description": "Ballpen", Quantity: "5" },
      },
    ],
    total_rows: 3,
    detected_selected_rows: [2, 3],
  };
}

function validationResult(): ValidationResult {
  return {
    id: "result-regression",
    project_name: "Regression session",
    preset: "generic_two_file",
    created_at: "2026-01-01T00:00:00Z",
    file_names: uploadedFiles.map((file) => file.name),
    total_selected_rows: 4,
    data_sources: [],
    extracted_records: [],
    rule_summaries: [
      {
        rule_id: "rule-regression",
        rule_name: "Item Description comparison",
        rule_type: "compare_values",
        severity: "high",
        discrepancy_count: 0,
      },
    ],
    discrepancies: [],
    breakdown: { high: 0, medium: 0, low: 0 },
  };
}

async function mockBackend(page: Page) {
  await page.route(/http:\/\/(127\.0\.0\.1|localhost):876[56]\/health$/, async (route) => {
    await route.fulfill({ status: 200, json: { status: "ok" } });
  });

  await page.route(/http:\/\/(127\.0\.0\.1|localhost):876[56]\/api\/v1\/validation\/recent$/, async (route) => {
    await route.fulfill({ status: 200, json: [] });
  });

  await page.route(/http:\/\/(127\.0\.0\.1|localhost):876[56]\/api\/v1\/files\/upload$/, async (route) => {
    await route.fulfill({ status: 200, json: uploadedFiles });
  });

  await page.route(/http:\/\/(127\.0\.0\.1|localhost):876[56]\/api\/v1\/validation\/sessions\/draft$/, async (route) => {
    await route.fulfill({
      status: 201,
      json: { id: "session-regression", project_name: "Regression session", status: "created" },
    });
  });

  await page.route(/http:\/\/(127\.0\.0\.1|localhost):876[56]\/api\/v1\/files\/data-source-preview$/, async (route) => {
    const payload = route.request().postDataJSON() as { data_source: ComparisonDataSource };
    await route.fulfill({ status: 200, json: previewForSource(payload.data_source) });
  });

  await page.route(/http:\/\/(127\.0\.0\.1|localhost):876[56]\/api\/v1\/validation\/run$/, async (route) => {
    await route.fulfill({ status: 200, json: validationResult() });
  });
}

test("main comparison workflow stays usable", async ({ page }) => {
  await mockBackend(page);

  await page.goto("/upload");
  await expect(page.getByRole("heading", { name: "Choose comparison files" })).toBeVisible();

  await page.getByLabel("Session name").fill("Regression session");
  await page.locator('input[type="file"]').setInputFiles([
    {
      name: uploadedFiles[0].name,
      mimeType: "text/csv",
      buffer: Buffer.from("Item Description,Quantity\nBond Paper,10\nBallpen,5\n"),
    },
    {
      name: uploadedFiles[1].name,
      mimeType: "text/csv",
      buffer: Buffer.from("Item Description,Quantity\nBond Paper,10\nBallpen,5\n"),
    },
  ]);

  await expect(page.getByText(uploadedFiles[0].name)).toBeVisible();
  await expect(page.getByText(uploadedFiles[1].name)).toBeVisible();
  await page.getByRole("button", { name: "Continue to validation" }).click();

  await expect(page.getByRole("heading", { name: "Confirm row setup" })).toBeVisible();
  await expect(page.getByText("High confidence").first()).toBeVisible();
  await expect(page.getByText("Selected data").first()).toBeVisible();
  await page.getByRole("button", { name: "Confirm all previewed" }).first().click();
  await expect(page.getByRole("button", { name: "Continue to comparison builder" }).first()).toBeEnabled();
  await page.getByRole("button", { name: "Continue to comparison builder" }).first().click();

  await expect(page.getByRole("heading", { name: "Comparison builder" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Go to step 1: Sources" })).toBeVisible();
  await page.getByRole("button", { name: "Go to step 3: Fields" }).click();

  await expect(page.getByRole("button", { name: "Add suggested fields" })).toHaveCount(2);
  for (let index = 0; index < uploadedFiles.length; index += 1) {
    await page.getByRole("button", { name: "Add suggested fields" }).nth(index).click();
    await expect(page.getByRole("dialog", { name: "Choose fields to add" })).toBeVisible();
    await expect(page.getByText("Item Description").first()).toBeVisible();
    await page.getByRole("button", { name: "Add selected fields" }).click();
  }
  await expect(page.getByText("2 mapped field(s)")).toHaveCount(2);

  await page.getByRole("button", { name: "Go to step 4: Rules" }).click();
  await expect(page.getByRole("button", { name: "Build suggested rules" })).toBeVisible();
  await page.getByRole("button", { name: "Build suggested rules" }).click();
  await expect(page.getByRole("dialog", { name: "Choose rules to add" })).toBeVisible();
  await expect(page.getByText("Item Description comparison")).toBeVisible();
  await page.getByRole("button", { name: "Add selected rules" }).click();
  await expect(page.getByText("Item Description comparison")).toBeVisible();

  await page.getByRole("button", { name: "Go to step 5: Review & Run" }).click();
  await expect(page.getByText("Setup is ready to validate.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Run validation" })).toBeEnabled();
  await page.getByRole("button", { name: "Run validation" }).click();

  await expect(page.getByRole("heading", { name: "Review rule-based discrepancies" })).toBeVisible();
  await expect(page.getByText("0 discrepancy(s) across 4 selected rows")).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Export report" })).toBeVisible();
});

test("session resume continues from restored files without reselecting them", async ({ page }) => {
  await page.route(/http:\/\/(127\.0\.0\.1|localhost):876[56]\/api\/v1\/validation\/recent$/, async (route) => {
    await route.fulfill({
      status: 200,
      json: [{
        id: "session-restore",
        project_name: "Saved draft",
        mode: "generic_two_file",
        file_names: uploadedFiles.map((file) => file.name),
        discrepancy_count: 0,
        created_at: "2026-01-01T00:00:00Z",
        can_continue_setup: true,
      }],
    });
  });

  await page.route(/http:\/\/(127\.0\.0\.1|localhost):876[56]\/api\/v1\/validation\/sessions\/session-restore$/, async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        result: {
          id: "session-restore",
          project_name: "Saved draft",
          preset: "generic_two_file",
          created_at: "2026-01-01T00:00:00Z",
          file_names: uploadedFiles.map((file) => file.name),
          total_selected_rows: 0,
          data_sources: [],
          extracted_records: [],
          rule_summaries: [],
          discrepancies: [],
          breakdown: { high: 0, medium: 0, low: 0 },
        },
        request: {
          project_name: "Saved draft",
          preset: "generic_two_file",
          data_sources: [],
          rules: [],
        },
        files: uploadedFiles,
      },
    });
  });

  await page.goto("/");
  await expect(page.getByRole("button", { name: "Continue setup" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Continue setup" }).first().click();
  await expect(page).toHaveURL(/\/mapping/);

  await page.getByRole("link", { name: "Upload files" }).click();
  await expect(page).toHaveURL(/\/upload/);
  await expect(page.getByRole("heading", { name: "Choose comparison files" })).toBeVisible();
  await expect(page.getByText(uploadedFiles[0].name).first()).toBeVisible();
  await expect(page.getByText(uploadedFiles[1].name).first()).toBeVisible();
  await page.getByRole("button", { name: "Continue to validation" }).click();
  await expect(page).toHaveURL(/\/mapping/);
  await expect(page.getByRole("heading", { name: "Confirm row setup" })).toBeVisible();
});

test("session draft keeps previously uploaded files when adding a new local file", async ({ page }) => {
  const newUploadedFile: UploadedFile = {
    id: "file-new",
    name: "new-worksheet.csv",
    extension: ".csv",
    size: 70,
    sheets: [
      {
        name: "Sheet1",
        row_count: 3,
        column_count: 2,
        detected_header_row: 1,
        headers: ["Item Description", "Quantity"],
        sample_rows: [
          { "Item Description": "Item Description", Quantity: "Quantity" },
          { "Item Description": "Bond Paper", Quantity: "10" },
        ],
      },
    ],
  };

  const requests: string[] = [];

  await page.route(/http:\/\/(127\.0\.0\.1|localhost):876[56]\/api\/v1\/validation\/recent$/, async (route) => {
    await route.fulfill({
      status: 200,
      json: [{
        id: "session-restore",
        project_name: "Saved draft",
        mode: "generic_two_file",
        file_names: uploadedFiles.map((file) => file.name),
        discrepancy_count: 0,
        created_at: "2026-01-01T00:00:00Z",
        can_continue_setup: true,
      }],
    });
  });

  await page.route(/http:\/\/(127\.0\.0\.1|localhost):876[56]\/api\/v1\/validation\/sessions\/draft$/, async (route) => {
    requests.push("draft");
    await route.fulfill({ status: 500, json: { detail: "Unexpected draft creation." } });
  });

  await page.route(/http:\/\/(127\.0\.0\.1|localhost):876[56]\/api\/v1\/files\/upload$/, async (route) => {
    requests.push("upload");
    await route.fulfill({ status: 200, json: [newUploadedFile] });
  });

  await page.route(/http:\/\/(127\.0\.0\.1|localhost):876[56]\/api\/v1\/validation\/sessions\/session-restore\/files$/, async (route) => {
    requests.push(`persist:${route.request().postDataJSON().file_id}`);
    await route.fulfill({
      status: 201,
      json: { id: newUploadedFile.id, name: newUploadedFile.name, path: `/sessions/Saved draft/uploads/${newUploadedFile.id}.csv`, size: newUploadedFile.size },
    });
  });

  await page.route(/http:\/\/(127\.0\.0\.1|localhost):876[56]\/api\/v1\/validation\/sessions\/session-restore$/, async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        result: {
          id: "session-restore",
          project_name: "Saved draft",
          preset: "generic_two_file",
          created_at: "2026-01-01T00:00:00Z",
          file_names: uploadedFiles.map((file) => file.name),
          total_selected_rows: 0,
          data_sources: [],
          extracted_records: [],
          rule_summaries: [],
          discrepancies: [],
          breakdown: { high: 0, medium: 0, low: 0 },
        },
        request: {
          project_name: "Saved draft",
          preset: "generic_two_file",
          data_sources: [],
          rules: [],
        },
        files: uploadedFiles,
      },
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Continue setup" }).first().click();
  await expect(page).toHaveURL(/\/mapping/);

  await page.getByRole("link", { name: "Upload files" }).click();
  await expect(page).toHaveURL(/\/upload/);
  await expect(page.getByRole("heading", { name: "Choose comparison files" })).toBeVisible();
  await expect(page.getByText(uploadedFiles[0].name).first()).toBeVisible();
  await expect(page.getByText(uploadedFiles[1].name).first()).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles([
    { name: newUploadedFile.name, mimeType: "text/csv", buffer: Buffer.from("Item Description,Quantity\nBond Paper,10\n") },
  ]);

  await expect(page.getByText(newUploadedFile.name)).toBeVisible();
  await page.getByRole("button", { name: "Continue to validation" }).click();

  await expect(page).toHaveURL(/\/mapping/);
  expect(requests).toEqual(["upload", `persist:${newUploadedFile.id}`]);
});
