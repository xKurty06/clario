# Template design

Templates will be explicit, user-confirmed extraction specifications. A template can define its name and file role; included/ignored sheets; header and first-data-row behavior; mapped procurement columns; optional lot rules; and ignored-row terms.

Application services own template validation and duplication rules. The template repository owns SQLite CRUD only. Extractors receive a validated template and do not persist it. Assisted mapping suggestions remain separate until the user confirms them.

The Phase 2 domain model should preserve enough metadata to explain every extracted value: source filename, sheet name, Excel row number, raw values, and normalized values.

