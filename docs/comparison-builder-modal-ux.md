# Comparison Builder Modal UX

## Why immediate auto-save was risky

The previous Comparison Builder drawers wrote directly into shared workflow state while the user was typing. That caused the source cards, field cards, and rule summaries behind the drawer to change immediately, even before the user had finished reviewing the edit.

That behavior was risky because:

- accidental edits changed mappings immediately
- closing a drawer could leave partial changes behind
- switching file, sheet, or row settings could invalidate previews without a clear save point
- new fields and rules were inserted before the user had confirmed they wanted them

## How draft editing works

Source, field, and rule editors now open in draft mode.

- When an editor opens, it copies the current saved item into local draft state.
- All typing and selection changes stay inside the drawer.
- The main workflow state only updates when the user clicks `Save changes` or `Create ...`.
- New sources, fields, and rules are not inserted into the workflow until create is confirmed.

The draft comparison is handled through a reusable `useDraftEditor` hook, which tracks whether the current draft differs from the original value.

## Modal and drawer action behavior

Every Comparison Builder drawer now uses the shared `BuilderDrawer` shell.

- Header: icon, title, description, dirty badge, close button
- Body: grouped sections with helper text and guidance
- Footer: `Cancel`, conditional `Discard changes`, and `Save changes` or `Create ...`

The shared drawer also includes:

- subtle open and close animation
- keyboard `Escape` handling
- visible focus states
- inline warning and validation messaging

## Cancel vs Discard vs Save

- `Cancel`: closes immediately when nothing changed. If the draft is dirty, it asks for confirmation before closing.
- `Discard changes`: only appears when the draft is dirty. It explicitly throws away the draft and restores the last saved state.
- `Save changes`: commits the current draft into workflow state.
- `Create source`, `Create field`, `Create rule`: add the new item only after validation passes and the user confirms creation by clicking the button.

No Comparison Builder drawer silently saves on close.

## Tooltip and helper text standards

New or updated controls should include at least one of the following:

- visible helper text under the control
- `FieldLabel` with `HelpTip`
- `title`
- `aria-label` for icon-only controls

Action buttons in the builder now include descriptive titles for source, field, rule, preview, row-selection, and validation actions.

## Remaining limitations

- Unsaved-change confirmation still uses native browser confirmation dialogs.
- Source preview state is cleared when source structure changes and the user saves without refreshing preview.
- Row selection still updates live in the main workflow because it operates on the row preview step rather than inside a draft drawer.
