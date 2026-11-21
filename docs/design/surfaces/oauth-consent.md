# OAuth Consent Surface

| Field | Value |
|---|---|
| Status | Active target |

## User Question

Should this application be allowed to act on my financial data as me?

## Composition

A standalone page outside the app shell, centered with the sign-in page's reading
width. In reading order:

1. Title naming the decision ("Cho phép truy cập").
2. The requesting application's name, followed by the host it returns to. The name is
   chosen by whoever registered the client, so the host is the trustworthy cue.
3. The signed-in account the access will be granted for.
4. A plain statement of scope: the application can read and change all of the
   user's financial data, as the user can.
5. One action region: "Cho phép" (primary) and "Từ chối" (secondary).

There is no persistent "remember this choice" option; every authorization request is
approved explicitly.

## States

| State | Behavior |
|---|---|
| Ready | Both actions enabled. |
| Pending | The chosen action shows progress; both actions are disabled to prevent duplicate submits. |
| Error | Adjacent recovery text; both actions are enabled again for retry. |
| Invalid or expired request | Explains that the link is invalid or expired and that the user should restart the connection from the application. No actions are shown. |
