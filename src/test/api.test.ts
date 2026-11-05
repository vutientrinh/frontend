import { describe, expect, it } from "vitest";
import { api } from "../api/client";
describe("mock API", () => {
  it("returns the empty customer page", async () => {
    const { data } = await api.GET("/customers", {
      baseUrl: "http://localhost/api",
    });
    expect(data).toEqual({
      content: [],
      page: 0,
      size: 20,
      totalElements: 0,
      totalPages: 0,
    });
  });
});
