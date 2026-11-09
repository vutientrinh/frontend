# How the frontend works

`src/app` holds the router, providers, and shell; `features` reserves a folder per domain screen; `api` owns the client and query hooks; `components` contains shared UI; `lib` contains reusable helpers. Feature work belongs in its own folder rather than the shell.

## Requests and server state

The request path is component → query hook → `api.GET('/customers')` → `/api/customers` → Vite proxy → Spring Boot `/customers`. `src/api/customers.ts` demonstrates `useQuery({ queryKey: ['customers'], queryFn: ... })`: the key identifies cached data and the query function fetches it. A screen can render loading, error and data states from the returned result.

For a write, use `useMutation` with a mutation function and call `queryClient.invalidateQueries({ queryKey: ['customers'] })` after success. Mutations do not automatically retry: payment creation can succeed even when a response is lost. For payment detail, use `refetchInterval` based on current server data: return an interval only for PENDING or PROCESSING and `false` for terminal states. Surface polling errors and avoid inventing status history.

Run `npm run gen:api` against the backend's OpenAPI document. `OPENAPI_URL` overrides the URL; the generator replaces `src/api/schema.d.ts`. The current declaration and `types.ts` are temporary TASK-002 assumptions, not a verified live contract. Reconcile and remove temporary types when generating.

## Forms and mocks

Use React Hook Form with a Zod schema and `zodResolver`; connect controls with `register`, show accessible field messages, and preserve values on server errors. `applyProblemErrors(problem, setError)` maps server field errors or supplies a root error. A 409 needs its own conflict handling.

In development `src/main.tsx` starts the browser worker before rendering. `src/mocks/seed.ts` supplies curated records, `db.ts` persists them, and handlers enforce mock business rules. Settings resets the demo data or enables simulated failures. Set `VITE_MOCK=0` before starting Vite to use the proxy and backend. The simulator advances new payments after roughly 3 and 8 seconds, stores history and events, and catches up on the next startup or request after a closed tab.

Tests start MSW from `src/test/setup.ts`; mock-backed screen tests install the real demo handlers and reset their in-memory state. Override handlers in a test for failure cases. Passing against the mock does not verify the live backend.

## Styling and money

`src/index.css` maps the light and `.dark` colors from `docs/design/tokens.json` to CSS variables and Tailwind color names. For example `bg-primary text-primary-foreground` uses the same tokens as shared UI. `components/ui` provides composable primitives and Sonner supplies notifications. The tokens are still under review.

Amounts stay decimal strings. `formatMoney('9007199254740993.1234', 'USD')` passes the string to `Intl.NumberFormat` without binary floating-point conversion; never use JavaScript arithmetic for money. Use a decimal library when a screen needs totals, and treat server totals as authoritative.

## Add a screen

1. Create the screen under `src/features/<feature>` and add its route in `src/app/App.tsx`.
2. Add a generated-client query hook under `src/api`; define stable keys and handle loading, empty and error states.
3. Compose shared UI and tokens, add accessible controls and form validation where needed.
4. Add MSW-backed tests for success and failure paths; run lint, tests and build.
