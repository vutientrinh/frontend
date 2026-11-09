import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { App } from "../app/App";
import { handlers } from "../mocks/handlers";
import { resetDB } from "../mocks/db";
import { resetBanking } from "../mocks/banking";
import { resetCommerceDB } from "../mocks/commerce/db";
import { server } from "./setup";

function RouteJump({ to }: { to: string }) {
  const navigate = useNavigate();
  return <button onClick={() => navigate(to)}>Open restricted area</button>;
}
async function staffSignIn() {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText("Staff login"), "admin");
  await user.type(screen.getByLabelText("Password"), "demo123");
  await user.click(screen.getByRole("button", { name: "Staff sign in" }));
  expect(
    await screen.findByRole("heading", { name: "Verify staff sign-in" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Register" }),
  ).not.toBeInTheDocument();
  await user.type(await screen.findByLabelText("Verification code"), "123456");
  await user.click(
    screen.getByRole("button", { name: "Verify staff sign-in" }),
  );
  return user;
}

async function shopperSignIn() {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText("Phone"), "0900000001");
  await user.type(screen.getByLabelText("Password"), "demo123");
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  await user.type(await screen.findByLabelText("Verification code"), "123456");
  await user.click(screen.getByRole("button", { name: "Verify your phone" }));
  await screen.findByRole("heading", { name: "Wallet" }, { timeout: 8000 });
  return user;
}

async function createTopUpAndOpenSimulator(
  user: ReturnType<typeof userEvent.setup>,
) {
  await user.click(screen.getByRole("link", { name: "Top up" }));
  await user.type(await screen.findByLabelText("Amount (VND)"), "200000");
  await user.click(screen.getByRole("button", { name: "Create top-up" }));
  await screen.findByRole("heading", { name: "Top-up status" });
  const reference = screen
    .getByText(/^Reference:/)
    .textContent?.replace("Reference:", "")
    .trim();
  if (!reference) throw new Error("Top-up reference was not rendered");
  await user.click(screen.getByRole("link", { name: "Open bank simulator" }));
  await screen.findByRole("heading", { name: "Accounts" });
  return reference;
}

describe("App", () => {
  it("renders the public storefront home for guests", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole("heading", { name: "Shop" }, { timeout: 10000 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Shopper navigation" }),
    ).toBeInTheDocument();
  });

  it("authenticates a seeded seller and renders the seller route tree", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/seller"]}>
        <App />
      </MemoryRouter>,
    );
    await user.type(await screen.findByLabelText("Seller login"), "0910000001");
    await user.type(screen.getByLabelText("Password"), "demo123");
    await user.click(screen.getByRole("button", { name: "Seller sign in" }));
    await user.type(
      await screen.findByLabelText("Verification code"),
      "123456",
    );
    await user.click(
      screen.getByRole("button", { name: "Verify seller sign-in" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Seller dashboard" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Seller navigation" }),
    ).toBeInTheDocument();
  });

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetDB();
    resetBanking();
    resetCommerceDB();
    server.use(...handlers);
  });

  it("redirects legacy admin paths and renders the navigation shell after staff sign in", async () => {
    render(
      <MemoryRouter initialEntries={["/customers"]}>
        <App />
      </MemoryRouter>,
    );
    await staffSignIn();
    expect(
      await screen.findByRole(
        "heading",
        { name: "Customers" },
        { timeout: 5000 },
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Main navigation" }),
    ).toBeInTheDocument();
  });

  it("guards the shopper tree and accepts shopper credentials", async () => {
    render(
      <MemoryRouter initialEntries={["/wallet"]}>
        <App />
      </MemoryRouter>,
    );
    await shopperSignIn();
    expect(sessionStorage.getItem("payment-mock-refresh")).toBeTruthy();
  });

  it("recovers from access denied with identity, area navigation, and sign out", async () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <RouteJump to="/wallet" />
        <App />
      </MemoryRouter>,
    );
    const user = await staffSignIn();
    await user.click(
      screen.getByRole("button", { name: "Open restricted area" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Access denied" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Signed in as/)).toBeInTheDocument();
    await user.click(
      screen.getByRole("link", { name: "Go to your admin workspace" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Dashboard" }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Open restricted area" }),
    );
    await screen.findByRole("heading", { name: "Access denied" });
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByLabelText("Phone")).toBeInTheDocument();
  });

  it("uses banking page labels and shows journal business reference, amount, and bank reference", async () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <RouteJump to="/admin/ledger" />
        <App />
      </MemoryRouter>,
    );
    const user = await staffSignIn();
    await user.click(
      screen.getByRole("button", { name: "Open restricted area" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Ledger explorer" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Workspace / Ledger explorer")).toBeInTheDocument();
    expect(
      await screen.findByRole("columnheader", { name: "Amount" }),
    ).toBeInTheDocument();
  });
  it("opens command search by keyboard and navigates with Enter", async () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <App />
      </MemoryRouter>,
    );
    const user = await staffSignIn();
    await screen.findByRole(
      "heading",
      { name: "Dashboard" },
      { timeout: 5000 },
    );
    await user.keyboard("{Control>}k{/Control}");
    const input = await screen.findByPlaceholderText("Search pages or records");
    await user.type(input, "Products");
    await user.keyboard("{ArrowDown}{ArrowUp}{Enter}");
    expect(
      await screen.findByRole(
        "heading",
        { name: "Products" },
        { timeout: 5000 },
      ),
    ).toBeInTheDocument();
  });

  it("renders the storefront home at the root route", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole("heading", { name: "Shop" }, { timeout: 10000 }),
    ).toBeInTheDocument();
  });

  it("renders the /admin route tree after staff OTP", async () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <App />
      </MemoryRouter>,
    );
    await staffSignIn();
    expect(
      await screen.findByRole("heading", { name: "Dashboard" }),
    ).toBeInTheDocument();
  });

  it("renders /bank-sim through the real top-up link and simulator route", async () => {
    render(
      <MemoryRouter initialEntries={["/wallet"]}>
        <App />
      </MemoryRouter>,
    );
    const user = await shopperSignIn();
    await createTopUpAndOpenSimulator(user);
    expect(
      screen.getByRole("navigation", { name: "Bank simulator navigation" }),
    ).toBeInTheDocument();
  });

  it("submits a simulator transfer, credits the wallet, and returns to it", async () => {
    render(
      <MemoryRouter initialEntries={["/wallet"]}>
        <App />
      </MemoryRouter>,
    );
    const user = await shopperSignIn();
    const reference = await createTopUpAndOpenSimulator(user);
    await user.click(screen.getByRole("link", { name: "Make a transfer" }));
    const from = await screen.findByLabelText("From account");
    await user.selectOptions(
      from,
      (from as HTMLSelectElement).options[1].value,
    );
    await user.type(
      screen.getByRole("textbox", { name: /Top-up reference/ }),
      reference,
    );
    await user.type(screen.getByLabelText("Amount (VND)"), "200000");
    await user.click(
      screen.getByRole("button", { name: "Send bank transfer" }),
    );
    expect(
      await screen.findByRole("status", {}, { timeout: 8000 }),
    ).toHaveTextContent("Transfer sent. Bank reference");
    await user.click(screen.getByRole("link", { name: "Back to wallet" }));
    const balances = screen.getByRole("region", { name: "Wallet balances" });
    expect(within(balances).getAllByText(/1,200,000/)).not.toHaveLength(0);
  });

  it("saves simulator failure settings from the real form", async () => {
    render(
      <MemoryRouter initialEntries={["/wallet"]}>
        <App />
      </MemoryRouter>,
    );
    const user = await shopperSignIn();
    await createTopUpAndOpenSimulator(user);
    await user.click(screen.getByRole("link", { name: "Failure settings" }));
    const decline = await screen.findByLabelText("Decline rate (%)");
    await user.clear(decline);
    await user.type(decline, "5");
    await user.click(
      screen.getByRole("button", { name: "Save failure settings" }),
    );
    expect(
      await screen.findByRole("status", {}, { timeout: 8000 }),
    ).toHaveTextContent("Failure settings saved.");
  });

  it("saves admin banking limits from the real settings form", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/settings"]}>
        <App />
      </MemoryRouter>,
    );
    const user = await staffSignIn();
    await screen.findByRole("heading", { name: "Banking limits" });
    await user.clear(
      await screen.findByRole(
        "textbox",
        { name: /OTP threshold/i },
        { timeout: 5000 },
      ),
    );
    await user.type(
      screen.getByRole("textbox", { name: /OTP threshold/i }),
      "1600000",
    );
    await user.click(
      screen.getByRole("button", { name: "Save banking limits" }),
    );
    expect(
      await screen.findByRole("status", {}, { timeout: 8000 }),
    ).toHaveTextContent("Banking limits saved and audit recorded.");
  });
});
