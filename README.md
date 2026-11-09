# Payment Project: web frontend

The web app of the Payment Project, a learning project about how a **marketplace with a built-in
e-wallet** really works: escrow, double-entry ledger, refunds, settlement. One React app serves
three audiences:

| Area | Who | URL | What you can do |
| --- | --- | --- | --- |
| **Storefront** | shoppers | `/` | Browse, search, product pages, shops, cart, checkout, pay by wallet or VietQR, track orders |
| **Wallet & account** | shoppers | `/wallet`, `/me` | Balance, top up, send money (OTP above the limit), statement, receipts, my QR, profile, addresses, KYC |
| **Seller portal** | shop owners | `/seller` | Onboarding, products and variants, inventory, orders, earnings, settings |
| **Back office / ERP** | staff | `/admin` | Customers and KYC, wallets, transfers, ledger journals, payments, orders, marketplace moderation, sellers, event monitor, audit |
| **Bank simulator** | developers | `/bank-sim` | Plays the external bank: approve or fail top-ups and payouts |

Everything runs on a **mock API** (MSW) by default, so you need no backend to try it.
The mobile shopper app lives in the sibling repo [`apps`](https://github.com/vutientrinh/apps).

## Quick start

```bash
npm install
npm run dev        # open the URL Vite prints (usually http://localhost:5173)
```

Demo accounts (password `demo123` for all):

| Role | Sign in with |
| --- | --- |
| Shopper | `0900000001` (also `0900000002`, `0900000003`) |
| Seller owner | `0910000001` (Saigon Gadget House), `0910000002`, `0910000003` |
| Admin | `admin` |
| Finance | `finance` |

The OTP code in the mock is always `123456`; the app shows it as a "Dev code" hint.

## Mock API and real backend

- In development the browser starts MSW and keeps demo data in `localStorage`. **Settings → Reset demo
  data** reloads the seed, and you can turn on simulated errors there too.
- `VITE_MOCK=0 npm run dev` sends requests to the real backend. Vite proxies `/api` to
  `http://localhost:8081` and strips the prefix.
- `npm run gen:api` regenerates the typed client from the backend's `/v3/api-docs`
  (override with `OPENAPI_URL`). Endpoints that the backend does not publish yet are typed by hand
  and marked provisional.
- The same mock handlers (`src/mocks/**`) also run as an HTTP server for the mobile app:
  `tools/mock-server` in the main project serves them on `:4010`.

## Stack

React 19 · TypeScript (strict) · Vite · React Router · TanStack Query and Table · React Hook Form + Zod ·
Tailwind CSS v4 + shadcn/ui (re-themed) · Zustand for UI state · big.js for money · MSW · Vitest +
Testing Library.

## Design

The look comes from the project brand plan (`docs/design/DESIGN.md` in the main project):

- **Colour:** Hạ Long jade as the primary colour, neutrals tinted toward it, and a lotus accent used
  only for sale prices. Light and dark themes, with contrast measured for both.
- **Type:** Be Vietnam Pro (self-hosted, full Vietnamese diacritics); JetBrains Mono for order numbers and IDs.
- **Money:** every amount goes through `MoneyText` (`src/components`). It uses tabular figures and
  a smaller, muted ₫. Incoming money is green, outgoing money gets a real minus sign, and balances
  are the largest number on their screen.
- Tokens live only in `src/index.css`; components never use raw colours.

Money is always a decimal string and never a JavaScript float.

## Project layout

```
src/
  app/          shell, routing, login, settings, error boundary
  components/   shared UI (ui/ = re-themed shadcn primitives, MoneyText, DataTable, ...)
  features/     storefront, seller, banking (wallet + bank sim + admin banking),
                admin-marketplace, commerce (shared types and hooks), payments, orders, ...
  mocks/        MSW handlers and seed data (banking, commerce, admin-marketplace)
  lib/          money, labels, helpers
  test/         Vitest suites
docs/HOW-IT-WORKS.md   learning guide to the flows behind the screens
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with the mock API |
| `npm run build` | Type-check (`tsc -b`) and production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest (170 tests). Use `npm test -- --maxWorkers=2` on a busy machine |
| `npm run format` | Prettier |
| `npm run gen:api` | Regenerate the API types from the backend |

Run `lint`, `test` and `build` before you push. See [the learning guide](docs/HOW-IT-WORKS.md) for how
payments, wallets and orders flow through the system.
