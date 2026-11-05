import { http, HttpResponse } from "msw";
export const handlers = [
  http.get("*/api/customers", () =>
    HttpResponse.json({
      content: [],
      page: 0,
      size: 20,
      totalElements: 0,
      totalPages: 0,
    }),
  ),
];
