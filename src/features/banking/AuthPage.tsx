import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { request } from "./client";
import { useAuth } from "./AuthContext";
import type { OtpChallenge as Challenge, Tokens } from "./types";
import { OtpChallenge, PasswordStrength } from "./OtpChallenge";
export default function AuthPage({
  mode,
  staff = false,
  seller = false,
}: {
  mode: "login" | "register" | "verify" | "forgot";
  staff?: boolean;
  seller?: boolean;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [otpId, setOtpId] = useState(""),
    [otpCode, setOtpCode] = useState(""),
    [demoCode, setDemoCode] = useState(""),
    [password, setPassword] = useState(""),
    [challenge, setChallenge] = useState<Challenge | null>(null),
    [phase, setPhase] = useState<"request" | "reset">("request");
  const navigate = useNavigate(),
    location = useLocation(),
    auth = useAuth();
  const state = location.state as {
    otpId?: string;
    challenge?: Challenge;
    staff?: boolean;
    from?: string;
    flow?: "login" | "register";
    seller?: boolean;
    demoCode?: string;
  } | null;
  const pending = challenge?.otpId ?? state?.otpId ?? otpId;
  const destination = (isStaff: boolean) => {
    const from = state?.from ?? "";
    if (seller) return from.startsWith("/seller/") ? from : "/seller";
    return isStaff
      ? from === "/admin" || from.startsWith("/admin/")
        ? from
        : "/admin"
      : from.startsWith("/") &&
          !from.startsWith("//") &&
          !from.startsWith("/admin")
        ? from
        : "/wallet";
  };
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    let responseDemoCode = "";
    try {
      if (mode === "login") {
        const result = await request<
          Tokens | ({ otpRequired: true } & Challenge)
        >("/auth/login", {
          method: "POST",
          body: JSON.stringify({
            login: form.get("login"),
            password: form.get("password"),
          }),
          onMockOtp: (code) => {
            responseDemoCode = code;
            setDemoCode(code);
          },
        });
        if ("otpRequired" in result) {
          navigate(
            seller ? "/seller/verify" : staff ? "/admin/verify" : "/verify-otp",
            {
              state: {
                otpId: result.otpId,
                challenge: result,
                staff,
                from: state?.from,
                flow: "login",
                demoCode: responseDemoCode,
              },
            },
          );
          return;
        }
        if (
          staff
            ? !result.user.roles.some((r) =>
                ["ADMIN", "FINANCE", "SUPPORT"].includes(r),
              )
            : seller
              ? !result.user.roles.includes("SELLER_OWNER")
              : !result.user.roles.includes("SHOPPER")
        )
          throw new Error("This account cannot access this area.");
        auth.signIn(result);
        navigate(seller ? destination(false) : destination(staff), {
          replace: true,
        });
      } else if (mode === "register") {
        const result = await request<Challenge>("/auth/register", {
          method: "POST",
          body: JSON.stringify({
            phone: form.get("phone"),
            password: form.get("password"),
          }),
          onMockOtp: (code) => {
            responseDemoCode = code;
            setDemoCode(code);
          },
        });
        navigate("/verify-otp", {
          state: {
            otpId: result.otpId,
            challenge: result,
            flow: "register",
            demoCode: responseDemoCode,
          },
        });
      } else if (mode === "verify") {
        if (!pending) throw new Error("Start registration or sign in again.");
        const result = await request<Tokens>("/auth/otp/verify", {
          method: "POST",
          body: JSON.stringify({ otpId: pending, code: form.get("code") }),
        });
        const staffFlow = staff || state?.staff === true;
        const sellerFlow = seller || state?.seller === true;
        if (
          staffFlow
            ? !result.user.roles.some((r) =>
                ["ADMIN", "FINANCE", "SUPPORT"].includes(r),
              )
            : sellerFlow
              ? !result.user.roles.includes("SELLER_OWNER")
              : !result.user.roles.includes("SHOPPER")
        )
          throw new Error("This account cannot access this area.");
        auth.signIn(result);
        navigate(sellerFlow ? destination(false) : destination(staffFlow), {
          replace: true,
        });
      } else if (phase === "request") {
        const result = await request<Challenge>("/auth/password/forgot", {
          method: "POST",
          body: JSON.stringify({ phone: form.get("phone") }),
          onMockOtp: setDemoCode,
        });
        setOtpId(result.otpId);
        setChallenge(result);
        setPhase("reset");
      } else {
        await request<void>("/auth/password/reset", {
          method: "POST",
          body: JSON.stringify({
            otpId: challenge?.otpId ?? otpId,
            code: form.get("code"),
            newPassword: form.get("password"),
          }),
        });
        navigate("/login", { replace: true });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }
  const title = seller
    ? mode === "verify"
      ? "Verify seller sign-in"
      : "Seller sign in"
    : staff
      ? mode === "verify"
        ? "Verify staff sign-in"
        : "Staff sign in"
      : mode === "login"
        ? "Sign in"
        : mode === "register"
          ? "Create account"
          : mode === "verify"
            ? "Verify your phone"
            : "Reset password";
  return (
    <main className="mx-auto max-w-md p-6 sm:pt-16">
      <Link
        to={seller ? "/seller/login" : staff ? "/admin/login" : "/login"}
        className="text-sm text-primary"
      >
        Payment Project
      </Link>
      <h1 className="mt-6 text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Demo environment</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        {mode === "login" && (
          <label className="block text-sm">
            {staff ? "Staff login" : seller ? "Seller login" : "Phone"}
            <input
              required
              name="login"
              autoComplete="username"
              className="mt-1 w-full rounded border border-border bg-background p-3"
            />
          </label>
        )}
        {(mode === "register" ||
          (mode === "forgot" && phase === "request")) && (
          <label className="block text-sm">
            Phone
            <input
              required
              name="phone"
              inputMode="tel"
              autoComplete="tel"
              className="mt-1 w-full rounded border border-border bg-background p-3"
            />
          </label>
        )}
        {(mode === "login" ||
          mode === "register" ||
          (mode === "forgot" && phase === "reset")) && (
          <label className="block text-sm">
            {phase === "reset" ? "New password" : "Password"}
            <input
              required
              minLength={mode === "login" ? 1 : 8}
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              className="mt-1 w-full rounded border border-border bg-background p-3"
            />
            {mode !== "login" && <PasswordStrength value={password} />}
          </label>
        )}
        {(mode === "verify" || (mode === "forgot" && phase === "reset")) &&
          (challenge ?? state?.challenge) && (
            <OtpChallenge
              challenge={challenge ?? state!.challenge!}
              onChange={(next) => {
                setChallenge(next);
                setOtpId(next.otpId);
                setError("");
              }}
              onDemoCodeChange={setDemoCode}
              code={otpCode}
              onCodeChange={setOtpCode}
              onExpired={() => {
                if (mode === "forgot") {
                  setPhase("request");
                  setChallenge(null);
                  setOtpId("");
                } else {
                  navigate(
                    state?.flow === "register"
                      ? "/register"
                      : staff || state?.staff
                        ? "/admin/login"
                        : "/login",
                    { replace: true },
                  );
                }
              }}
            />
          )}
        {(demoCode || state?.demoCode) &&
          (mode === "verify" || (mode === "forgot" && phase === "reset")) && (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Demo code: {demoCode || state?.demoCode} ·{" "}
              <Button
                type="button"
                className="h-auto bg-transparent p-0 align-baseline text-primary underline"
                onClick={() => setOtpCode(demoCode || state?.demoCode || "")}
              >
                Fill
              </Button>
            </p>
          )}
        {mode === "register" && (
          <label className="flex gap-2 text-sm">
            <input type="checkbox" required /> I accept the demo terms.
          </label>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Please wait…" : title}
        </Button>
      </form>
      {seller && (
        <Link
          className="mt-5 inline-block text-sm text-primary"
          to="/seller/onboarding"
          state={{ from: "/seller/onboarding" }}
        >
          Register as seller
        </Link>
      )}
      {!staff && !seller && (
        <div className="mt-5 flex flex-wrap gap-4 text-sm">
          <Link className="text-primary" to="/login">
            Sign in
          </Link>
          <Link className="text-primary" to="/register">
            Register
          </Link>
          <Link className="text-primary" to="/forgot-password">
            Forgot password
          </Link>
        </div>
      )}
    </main>
  );
}
