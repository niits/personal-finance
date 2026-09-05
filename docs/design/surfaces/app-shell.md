# App Shell Surface

| Field | Value |
|---|---|
| Status | Active target |

## Purpose

The shell answers where the user is and how to reach the four primary areas without
competing with financial content.

## Navigation

The persistent destinations are Tổng quan, Thống kê, Tài chính, and Tài khoản. The
canonical routes are owned by [`architecture/technical.md`](../../architecture/technical.md).
On phones they appear in a safe-area-aware bottom navigation with visible labels. The
active destination uses Action Blue and a non-color cue.

Detail and management surfaces use a quiet contextual header with an explicit back
action. Persistent black top navigation and unlabeled icon navigation are prohibited.

## Responsive Behavior

Phone content reserves bottom-navigation and safe-area space. Larger viewports center
the same reading order; a desktop sidebar requires a separate approved design-system
decision.

## States

Preserve shell geometry during initial session resolution. Expired sessions explain
the interruption and offer sign-in again. Network and route-loading states must not
flash unauthenticated content or erase useful page context.
