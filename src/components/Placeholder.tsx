import { Link } from "react-router-dom";
export function Placeholder({ title }: { title: string }) {
  return (
    <>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-muted-foreground">
        {title === "Page not found"
          ? "The page you requested could not be found."
          : "This screen is coming soon."}
      </p>
      {title === "Page not found" && (
        <Link className="mt-4 inline-block text-primary underline" to="/">
          Return to dashboard
        </Link>
      )}
      {title === "Orders" && (
        <Link
          className="mt-4 inline-block text-primary underline"
          to="/orders/new"
        >
          Create order
        </Link>
      )}
      {title === "Payments" && (
        <Link
          className="mt-4 inline-block text-primary underline"
          to="/payments/new"
        >
          Create payment
        </Link>
      )}
    </>
  );
}
