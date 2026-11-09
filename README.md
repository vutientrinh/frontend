# Payment Project frontend

Install with `npm install`, start with `npm run dev`, and open the URL Vite prints. The development proxy sends `/api` to `http://localhost:8081` after stripping the prefix. Sign in with any email and a password of at least six characters. Authentication is a local demo only.

In development the browser starts MSW by default and stores demo records in localStorage. Settings can reset demo data and enable simulated errors. Existing local data is preserved across updates; reset it to load the latest curated seed. Use `VITE_MOCK=0` and restart Vite to send requests to the real backend instead. The mock is only enabled by default in development.

Run `npm run gen:api` after TASK-002 publishes `/v3/api-docs`. Set `OPENAPI_URL` to override the default URL. The checked-in types and proposed history, summary and outbox endpoints are provisional; regenerate and reconcile the client once the backend contract is available. Tests use MSW's Node server.

Run `npm run lint`, `npm run test`, and `npm run build` before reporting changes. `npm run format` applies Prettier. See [the learning guide](docs/HOW-IT-WORKS.md).
