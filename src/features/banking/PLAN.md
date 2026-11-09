# TASK-014 R1 + M3/M4 frontend plan

- R1 primary action: help shoppers scan their wallet activity and start a transfer without decoding backend enums.
- R1 hierarchy: available balance first; ledger/held and monthly usage second; quick actions and recent activity next.
- R1 desktop: header and left rail, wide balance hero, action tiles, limit band, recent activity.
- R1 mobile (375px): compact header, stacked balance/actions/list, fixed bottom nav with safe hit targets.
- Reuse shared Money, StatusBadge, ErrorState, PageHeader and Button; add transaction presentation/day grouping.
- Cover loading/error/empty/pending/completed transaction rows and lookup/transfer feedback.
- M3 primary action: pay a pending top-up from a selected bank account; account balance and transfer result stay visible.
- M3 desktop: distinct simulator header/accent, account list alongside transfer form, failure controls below.
- M3 mobile: sections stack; forms and tables become compact cards; no fixed-width layouts.
- M3 APIs: account list/create/deposit, account/reference transfer, failure settings; idempotent transfers and delayed callback processing.
- M4 primary actions: locate/freeze a wallet and trace its journal; keep trial balance visible.
- M4 desktop: Banking navigation, filterable tables, selected record detail, semantic balance/status columns.
- M4 mobile: filter controls wrap, ledger rows stack, detail actions remain reachable.
- M4 mock APIs: wallets/detail/freeze, operations incl. suspense, chart/journals/detail/trial balance, audit, editable limits.
- Record freeze/unfreeze and settings changes in immutable mock audit rows with actor/time/before/after.
- Preserve P0 routes and settings; add banking limits to existing settings surface and Banking group navigation.
- Self-critique: omit decorative simulator gauges and KPI cards; prioritize actionable account balances and trace evidence.
- Validation: add UI/API tests for R1, bank transfer/failure toggles, suspense, staff access, freeze/audit, settings and balanced ledger.
