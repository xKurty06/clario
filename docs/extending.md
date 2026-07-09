# Extension guide

## Add a validator

1. Implement `BaseValidator` in `backend/app/validators`.
2. Give it a stable `rule_id` and keep it limited to one concern.
3. Return discrepancy objects without mutating comparison rows.
4. Register it in the validation-service composition root.
5. Add focused tests under `backend/tests/test_validators`.

## Add a file extractor

1. Implement `BaseExtractor` in `backend/app/extractors`.
2. Validate the format before parsing and expose a clear unsupported/corrupt-file error.
3. Produce the same traceable row model as existing extractors.
4. Register it through the file/extraction service, not directly in a route.
5. Add fixtures and extraction tests.

## Add a report format

1. Implement `BaseReportGenerator` in `backend/app/reports`.
2. Accept prepared report data and a new destination path.
3. Do not query the database or re-run validation.
4. Add formatting and page-output tests under `backend/tests/test_reports`.

## Add an AI provider

1. Implement `AIAssistantProvider` under `backend/app/ai_assistant/providers`.
2. Make availability explicit and keep the provider optional.
3. Return suggestions separately from confirmed mappings and validation results.
4. Keep all network access opt-in; prefer a local provider for the local-first product.
5. Never grant the provider file-modification or automatic-correction authority.

