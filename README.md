# Payment Project frontend

Install with `npm install`, start with `npm run dev`, and open the URL Vite prints. The development proxy sends `/api` to `http://localhost:8081` after stripping the prefix. All screens are placeholders.

Run `npm run gen:api` after TASK-002 publishes `/v3/api-docs`. Set `OPENAPI_URL` to override the default URL. The checked-in types are provisional and must be replaced with generated types. Tests use MSW's Node server; browser mock mode is not enabled. The mock customer list returns an empty page.

Run `npm run lint`, `npm run test`, and `npm run build` before reporting changes. `npm run format` applies Prettier. See [the learning guide](docs/HOW-IT-WORKS.md).
