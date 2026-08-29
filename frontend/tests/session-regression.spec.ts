import { expect, test } from "@playwright/test";

const savedSession = {
  id: "session-restore",
  project_name: "Saved draft",
  mode: "generic_two_file",
  file_names: ["reference.xlsx", "supplier.xlsx"],
  discrepancy_count: 0,
  created_at: "2026-01-01T00:00:00Z",
  can_continue_setup: true,
};

test("continuing a saved session keeps its id and does not create a duplicate", async ({ page }) => {
  let draftCalls = 0;

  await page.route(/http:\/\/(127\.0\.0\.1|localhost):8765\/api\/v1\/validation\/recent$/, async (route) => {
    await route.fulfill({ status: 200, json: [savedSession] });
  });

  await page.route(/http:\/\/(127\.0\.0\.1|localhost):8765\/api\/v1\/validation\/sessions\/session-restore$/, async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        result: {
          id: "session-restore",
          project_name: "Saved draft",
          preset: "generic_two_file",
          created_at: "2026-01-01T00:00:00Z",
          file_names: savedSession.file_names,
          total_selected_rows: 0,
          data_sources: [],
          extracted_records: [],
          rule_summaries: [],
          discrepancies: [],
          breakdown: { high: 0, medium: 0, low: 0 },
        },
        request: { project_name: "Saved draft", preset: "generic_two_file", data_sources: [], rules: [] },
        files: savedSession.file_names.map((name, index) => ({ id: `file-${index}`, name, extension: ".xlsx", size: 100, sheets: [] })),
      },
    });
  });

  await page.route(/http:\/\/(127\.0\.0\.1|localhost):8765\/api\/v1\/validation\/sessions\/draft$/, async (route) => {
    draftCalls += 1;
    await route.fulfill({ status: 500, json: { detail: "Duplicate session creation detected." } });
  });

  await page.goto("/");
  await expect(page.getByRole("button", { name: "Continue setup" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Continue setup" }).first().click();

  await expect(page).toHaveURL(/\/mapping/);
  expect(draftCalls).toBe(0);
});
