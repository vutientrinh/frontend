import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import Account from "../features/banking/Account";
import { AuthProvider, useAuth } from "../features/banking/AuthContext";
import AuthPage from "../features/banking/AuthPage";
import { setSession } from "../features/banking/client";
import type { Tokens } from "../features/banking/types";
import { bankingHandlers, resetBanking } from "../mocks/banking";
import { server } from "./setup";

const apiUrl = (path: string) => new URL(`/api${path}`, window.location.origin);

async function signInWithoutDevice() {
  const response = await fetch(apiUrl("/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login: "0900000001", password: "demo123" }),
  });
  expect(response.ok).toBe(true);
  setSession((await response.json()) as Tokens);
}

function AccountAfterRestore() {
  const { user, loading } = useAuth();
  if (loading) return <p role="status">Restoring account</p>;
  return user ? <Account /> : null;
}

function mountAccount() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter>
          <AccountAfterRestore />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

function mountAuthPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={["/login"]}>
          <Routes>
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/verify-otp" element={<AuthPage mode="verify" />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetBanking();
  server.use(...bankingHandlers);
});

describe("shopper account management", () => {
  it("creates, edits, defaults, and deletes delivery addresses", async () => {
    const user = userEvent.setup();
    await signInWithoutDevice();
    mountAccount();
    await screen.findByRole("heading", { name: "Profile" });
    await user.click(screen.getByRole("button", { name: "Addresses" }));
    await screen.findByText("No saved addresses");

    await user.click(
      screen.getByRole("button", { name: "Add your first address" }),
    );
    let dialog = screen.getByRole("dialog", { name: "Add delivery address" });
    await user.type(
      within(dialog).getByLabelText("Recipient name"),
      "Mai Nguyen",
    );
    await user.type(
      within(dialog).getByLabelText("Phone number"),
      "0901234567",
    );
    await user.type(
      within(dialog).getByLabelText("Street address"),
      "12 Le Loi",
    );
    await user.type(within(dialog).getByLabelText("Ward"), "Ben Nghe");
    await user.type(within(dialog).getByLabelText("District"), "District 1");
    await user.type(
      within(dialog).getByLabelText("Province / city"),
      "Ho Chi Minh City",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Add address" }),
    );
    const first = await screen.findByText("Mai Nguyen");
    expect(first.closest("article")).toHaveTextContent("Default");
    expect(first.closest("article")).toHaveTextContent(
      "12 Le Loi, Ben Nghe, District 1, Ho Chi Minh City",
    );

    await user.click(screen.getByRole("button", { name: "Add address" }));
    dialog = screen.getByRole("dialog", { name: "Add delivery address" });
    await user.type(
      within(dialog).getByLabelText("Recipient name"),
      "Linh Tran",
    );
    await user.type(
      within(dialog).getByLabelText("Phone number"),
      "0909876543",
    );
    await user.type(
      within(dialog).getByLabelText("Street address"),
      "5 Nguyen Hue",
    );
    await user.type(within(dialog).getByLabelText("Ward"), "Ben Nghe");
    await user.type(within(dialog).getByLabelText("District"), "District 1");
    await user.type(
      within(dialog).getByLabelText("Province / city"),
      "Ho Chi Minh City",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Add address" }),
    );
    const second = await screen.findByText("Linh Tran");
    const secondCard = second.closest("article");
    expect(secondCard).not.toHaveTextContent("Default");
    await user.click(
      within(secondCard!).getByRole("button", { name: "Set as default" }),
    );
    await waitFor(() => expect(secondCard).toHaveTextContent("Default"));
    expect(first.closest("article")).not.toHaveTextContent("Default");

    await user.click(within(secondCard!).getByRole("button", { name: "Edit" }));
    dialog = screen.getByRole("dialog", { name: "Edit address" });
    const street = within(dialog).getByLabelText("Street address");
    await user.clear(street);
    await user.type(street, "8 Dong Khoi");
    await user.click(
      within(dialog).getByRole("button", { name: "Save address" }),
    );
    await screen.findByText(
      "8 Dong Khoi, Ben Nghe, District 1, Ho Chi Minh City",
    );

    const firstCard = first.closest("article");
    await user.click(
      within(firstCard!).getByRole("button", { name: "Delete" }),
    );
    const confirmation = screen.getByRole("dialog", {
      name: "Delete Mai Nguyen?",
    });
    await user.click(
      within(confirmation).getByRole("button", { name: "Confirm" }),
    );
    await waitFor(() =>
      expect(screen.queryByText("Mai Nguyen")).not.toBeInTheDocument(),
    );
  });

  it("validates password confirmation and saves a matching password", async () => {
    const user = userEvent.setup();
    await signInWithoutDevice();
    mountAccount();
    await screen.findByRole("heading", { name: "Profile" });
    await user.click(screen.getByRole("button", { name: "Security" }));
    await user.type(screen.getByLabelText("Current password"), "demo123");
    await user.type(screen.getByLabelText(/^New password/), "newpass123");
    await user.type(
      screen.getByLabelText("Confirm new password"),
      "different123",
    );
    await user.click(screen.getByRole("button", { name: "Update password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("do not match");

    const confirmation = screen.getByLabelText("Confirm new password");
    await user.clear(confirmation);
    await user.type(confirmation, "newpass123");
    await user.click(screen.getByRole("button", { name: "Update password" }));
    await waitFor(() =>
      expect(screen.getByLabelText(/^New password/)).toHaveValue(""),
    );

    const loginResponse = await fetch(apiUrl("/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login: "0900000001", password: "newpass123" }),
    });
    expect(loginResponse.ok).toBe(true);
  });

  it("shows the mock OTP hint and fills the verification code", async () => {
    const user = userEvent.setup();
    mountAuthPage();
    await user.type(await screen.findByLabelText("Phone"), "0900000001");
    await user.type(screen.getByLabelText("Password"), "demo123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText(/Demo code: 123456/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Fill" }));
    expect(screen.getByLabelText("Verification code")).toHaveValue("123456");
  });
});
