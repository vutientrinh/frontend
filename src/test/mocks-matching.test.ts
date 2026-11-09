import { describe, expect, it } from "vitest";
import { handlers } from "../mocks/handlers";

describe("MSW API route boundaries", () => {
  it.each(["/src/api/client.ts", "/src/features/x.tsx"])(
    "does not treat %s as an API request",
    async (path) => {
      const request = new Request(new URL(path, window.location.origin));
      const matches = await Promise.all(
        handlers.map((handler) => handler.test({ request })),
      );
      expect(matches).not.toContain(true);
    },
  );
});
