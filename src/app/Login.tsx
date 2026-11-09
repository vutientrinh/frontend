import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
export default function Login() {
  useEffect(() => {
    document.title = "Sign in | Payment Project";
  }, []);
  const navigate = useNavigate();
  const [error, setError] = useState("");
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    if (!email || password.length < 6) {
      setError("Enter an email and a password of at least 6 characters.");
      return;
    }
    localStorage.setItem("payment-demo-user", email);
    navigate("/", { replace: true });
  }
  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <section className="flex flex-col justify-between border-r border-border bg-muted p-10 text-foreground">
        <strong className="text-xl">Payment Project</strong>
        <div>
          <h1 className="text-3xl font-semibold">
            Payment operations, in one place.
          </h1>
          <p className="mt-3">A workspace for exploring payment operations.</p>
        </div>
        <small>Demo environment</small>
      </section>
      <section className="flex items-center justify-center p-8">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4">
          <div>
            <h2 className="text-2xl font-semibold">Sign in to the demo</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This is a local demo, not a secure login.
            </p>
          </div>
          <label className="block text-sm">
            Email
            <Input name="email" type="email" autoComplete="username" required />
          </label>
          <label className="block text-sm">
            Password
            <Input
              name="password"
              type="password"
              autoComplete="current-password"
              minLength={6}
              required
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full">
            Sign in
          </Button>
        </form>
      </section>
    </main>
  );
}
