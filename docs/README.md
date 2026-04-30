# Documentation — Personal Finance Tracker

## Documents

| File | Purpose |
|------|---------|
| [BRD.md](./BRD.md) | Business Requirements Document — source of truth for all requirements, data model, business rules, and UI specs |
| [TECHNICAL_DESIGN.md](./TECHNICAL_DESIGN.md) | Technical design — DB schema, API contracts, edge cases, computed values |
| [FLOWS.md](./FLOWS.md) | Sequence diagrams for all user-facing and system flows |
| [TESTING.md](./TESTING.md) | Testing strategy — unit and integration test setup, patterns, and coverage targets |
| [API_CACHE.md](./API_CACHE.md) | API caching strategy — HTTP Cache-Control headers and SWR client cache |
| [dev_logs/](./dev_logs/) | Chronological development logs — debugging sessions, decisions, and implementation notes |

## Quick Reference

### Requirement IDs

| Prefix | Domain |
|--------|--------|
| AUTH-xx | Authentication |
| TXN-xx | Transaction management |
| MBGT-xx | Monthly budget |
| CBGT-xx | Custom budget |
| BCFG-xx | Budget config |
| CAT-xx | Category management |
| CHART-xx | Pace line chart |
| RPT-xx | Reporting & dashboard |
| BR-xx | Business rules |
| NFR-xx | Non-functional requirements |

### Flow Index

| # | Flow |
|---|------|
| 1 | GitHub OAuth login |
| 2 | Log expense transaction |
| 3 | Log income transaction |
| 4 | Create monthly budget |
| 5 | Adjust monthly budget |
| 6 | Create custom budget |
| 7 | Toggle custom budget active/inactive |
| 8 | Add category |
| 9 | Delete category |
| 10 | Update budget config |
