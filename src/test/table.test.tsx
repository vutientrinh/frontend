import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { DataTable } from "../components/DataTable";
function Location() {
  return <output data-testid="location">{useLocation().search}</output>;
}
describe("DataTable", () => {
  it("stores search and pagination in the URL", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/?page=1"]}>
        <DataTable
          data={[{ name: "Alpha" }]}
          columns={[{ accessorKey: "name", header: "Name" }]}
          total={60}
          onRetry={() => {}}
        />
        <Location />
      </MemoryRouter>,
    );
    await user.type(screen.getByRole("textbox", { name: "Search" }), "abc");
    expect(screen.getByTestId("location")).toHaveTextContent("?q=abc");
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByTestId("location")).toHaveTextContent("page=1");
  });
});
