import createClient from "openapi-fetch";
import type { paths } from "./schema";
export const api = createClient<paths>({
  baseUrl: new URL("/api", window.location.origin).toString(),
  fetch: (...args) => fetch(...args),
});
