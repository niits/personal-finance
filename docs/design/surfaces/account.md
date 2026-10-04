# Account Surface

| Field | Value |
|---|---|
| Status | Active target |

## User Question

Where do I manage my data model, authentication methods, and session?

## Composition

Management links for Categories and Budgets come first, followed by identity and
authentication methods. Google and GitHub are both supported target providers and
their connected, available, pending, and error states must be clear. Sign-out is a
named destructive action with confirmation.

Account and transaction data export is not supported and must not appear as an action
or documented capability.

## States

Cover session loading, provider partial failure, provider linking pending/error,
expired session, sign-out pending/error, and unavailable network. Provider failure
must not block unrelated management links.
