import type { Tokens, User } from "./types";
let accessToken = "";
const refreshKey = "payment-mock-refresh";
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export type RequestOptions = RequestInit & {
  onMockOtp?: (code: string) => void;
};
export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { onMockOtp, ...requestOptions } = options;
  const headers = new Headers(requestOptions.headers);
  if (requestOptions.body) headers.set("Content-Type", "application/json");
  let device = localStorage.getItem("payment-mock-device");
  if (!device) {
    device = crypto.randomUUID();
    localStorage.setItem("payment-mock-device", device);
  }
  headers.set("X-Mock-Device", device);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const response = await fetch(new URL(`/api${path}`, window.location.origin), {
    ...requestOptions,
    headers,
  });
  if (!response.ok) {
    const problem = await response
      .json()
      .catch(() => ({ detail: "Request failed" }));
    throw new ApiError(
      response.status,
      String(problem.detail ?? "Request failed"),
    );
  }
  const otp = response.headers.get("X-Mock-OTP");
  if (otp && import.meta.env.DEV) {
    onMockOtp?.(otp);
    const { toast } = await import("sonner");
    toast.info(`Mock OTP: ${otp}`);
  }
  return response.status === 204
    ? (undefined as T)
    : ((await response.json()) as T);
}
export function setSession(tokens: Tokens) {
  accessToken = tokens.accessToken;
  sessionStorage.setItem(refreshKey, tokens.refreshToken);
}
let restorePromise: Promise<User | null> | undefined;
export function restoreSession(): Promise<User | null> {
  return (restorePromise ??= restore().finally(() => {
    restorePromise = undefined;
  }));
}
async function restore(): Promise<User | null> {
  const refreshToken = sessionStorage.getItem(refreshKey);
  if (!refreshToken) return null;
  try {
    const t = await request<Tokens>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
    setSession(t);
    return t.user;
  } catch {
    accessToken = "";
    sessionStorage.removeItem(refreshKey);
    return null;
  }
}
export async function logout() {
  const refreshToken = sessionStorage.getItem(refreshKey);
  try {
    await request<void>("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
  } finally {
    accessToken = "";
    sessionStorage.removeItem(refreshKey);
  }
}
