# Transaction Surface

| Field | Value |
|---|---|
| Status | Active target |

## User Task

Record or correct a transaction quickly without losing its financial context.

## Form Hierarchy

The shared create/edit form presents direction and amount first, followed by date and
the fields required by the selected transaction kind. Consumption exposes category,
cash/card group, custom budgets, note, and emoji. Debt or savings movement exposes the
finance account and allows inline account creation.

Account association is edited only here. There is no link/unlink sheet.

## Responsive Surface

On mobile the form is a full-screen surface with stable title and save/close actions.
On larger viewports it becomes a bounded dialog or sheet according to available space.
In both forms, the body handles keyboard resizing without hiding the active field or
primary action.

## Safety And States

Visible labels remain after entry. Validation explains recovery beside the affected
field. Dismissing dirty input requires confirmation. Cover missing prerequisites,
loading options, saving, duplicate submission, server error, expired session, long
names, large amounts, and open keyboard. Delete confirmation names the transaction
and consequence.

Domain invariants are defined in
[`product/behavior/transactions.md`](../../product/behavior/transactions.md).
