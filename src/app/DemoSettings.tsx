import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Globe2, Palette, UserRound, Database } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ConfirmDialog, PageHeader } from "../components/shared";
import { applyTheme, getTheme, type Theme } from "./theme";
import { useOptionalAuth } from "../features/banking/AuthContext";
import { useNavigate } from "react-router-dom";
import { BankingSettingsPanel } from "../features/banking/AdminBanking";
const selectClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
export default function DemoSettings() {
  const client = useQueryClient();
  const auth = useOptionalAuth();
  const navigate = useNavigate();
  const [errors, setErrors] = useState(
      () => localStorage.getItem("payment-demo-errors") === "true",
    ),
    [open, setOpen] = useState(false),
    [email, setEmail] = useState(
      () => localStorage.getItem("payment-demo-user") ?? "",
    ),
    [theme, setTheme] = useState<Theme>(getTheme),
    [density, setDensity] = useState(
      () => localStorage.getItem("payment-density") ?? "comfortable",
    ),
    [locale, setLocale] = useState(
      () => localStorage.getItem("payment-locale") ?? "en-US",
    );
  useEffect(() => {
    document.title = "Settings | Payment Project";
  }, []);
  useEffect(() => {
    const update = () => setTheme(getTheme());
    window.addEventListener("payment-theme-change", update);
    return () => window.removeEventListener("payment-theme-change", update);
  }, []);
  const saveProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    localStorage.setItem("payment-demo-user", email.trim());
    window.dispatchEvent(new Event("payment-user-change"));
    toast.success("Profile saved");
  };
  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage your demo workspace and preferences."
      />
      <div className="grid max-w-5xl gap-6">
        <section className="border-t border-border bg-background p-6">
          <div className="mb-5 flex gap-3">
            <span className="rounded-lg bg-muted p-2 text-primary">
              <UserRound size={20} />
            </span>
            <div>
              <h2 className="font-semibold">Profile</h2>
              <p className="text-sm text-muted-foreground">
                Your local demo identity.
              </p>
            </div>
          </div>
          <form
            onSubmit={saveProfile}
            className="flex max-w-xl flex-wrap items-end gap-3"
          >
            <label className="min-w-48 flex-1 text-sm font-medium">
              Email address
              <Input
                className="mt-1"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <Button type="submit">Save profile</Button>
          </form>
        </section>
        <section className="border-t border-border bg-background p-6">
          <div className="mb-5 flex gap-3">
            <span className="rounded-lg bg-muted p-2 text-primary">
              <Palette size={20} />
            </span>
            <div>
              <h2 className="font-semibold">Appearance</h2>
              <p className="text-sm text-muted-foreground">
                Choose how your workspace looks.
              </p>
            </div>
          </div>
          <div className="grid max-w-xl gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">
              Theme
              <select
                className={`${selectClass} mt-1`}
                value={theme}
                onChange={(e) => {
                  const next = e.target.value as Theme;
                  setTheme(next);
                  applyTheme(next);
                }}
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
            <label className="text-sm font-medium">
              Density
              <select
                className={`${selectClass} mt-1`}
                value={density}
                onChange={(e) => {
                  setDensity(e.target.value);
                  localStorage.setItem("payment-density", e.target.value);
                  document.documentElement.dataset.density = e.target.value;
                }}
              >
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
              </select>
            </label>
          </div>
        </section>
        <section className="border-t border-border bg-background p-6">
          <div className="mb-5 flex gap-3">
            <span className="rounded-lg bg-muted p-2 text-primary">
              <Globe2 size={20} />
            </span>
            <div>
              <h2 className="font-semibold">Locale and number format</h2>
              <p className="text-sm text-muted-foreground">
                Applied to displayed monetary values.
              </p>
            </div>
          </div>
          <label className="block max-w-xs text-sm font-medium">
            Locale
            <select
              className={`${selectClass} mt-1`}
              value={locale}
              onChange={(e) => {
                setLocale(e.target.value);
                localStorage.setItem("payment-locale", e.target.value);
              }}
            >
              <option value="en-US">English (United States)</option>
              <option value="vi-VN">Vietnamese (Vietnam)</option>
            </select>
          </label>
          <p className="mt-2 text-xs text-muted-foreground">
            Example:{" "}
            {new Intl.NumberFormat(locale, {
              style: "currency",
              currency: "VND",
            }).format(1250000)}
          </p>
        </section>
        <section className="border-t border-border bg-background p-6">
          <div className="mb-5 flex gap-3">
            <span className="rounded-lg bg-muted p-2 text-primary">
              <Database size={20} />
            </span>
            <div>
              <h2 className="font-semibold">Demo data</h2>
              <p className="text-sm text-muted-foreground">
                Local browser data for exploring the app.
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {import.meta.env.VITE_MOCK === "0"
              ? "Real backend mode is enabled."
              : "Mock mode is enabled in development."}{" "}
            Set VITE_MOCK=0 and restart Vite to use the backend.
          </p>
          {import.meta.env.DEV && (
            <label className="my-4 flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={errors}
                onChange={(e) => {
                  setErrors(e.target.checked);
                  localStorage.setItem(
                    "payment-demo-errors",
                    String(e.target.checked),
                  );
                }}
              />
              Simulate errors (about 10%)
            </label>
          )}
          <Button onClick={() => setOpen(true)}>Reset demo data</Button>
          <ConfirmDialog
            open={open}
            onOpenChange={setOpen}
            title="Reset demo data?"
            description="This restores seeded P0 and banking data, invalidates all demo sessions, and signs you out."
            onConfirm={() => {
              void (auth?.signOut() ?? Promise.resolve())
                .then(() =>
                  Promise.all([
                    import("../mocks/db"),
                    import("../mocks/banking"),
                    import("../mocks/commerce/db"),
                  ]),
                )
                .then(
                  ([{ resetDB }, { resetBanking }, { resetCommerceDB }]) => {
                    resetDB();
                    resetBanking();
                    resetCommerceDB();
                    client.clear();
                    toast.success("Demo data reset");
                    navigate("/admin/login", { replace: true });
                  },
                )
                .catch(() => toast.error("Could not reset demo data"));
            }}
          />
        </section>
        {auth?.user && <BankingSettingsPanel />}
      </div>
    </>
  );
}
