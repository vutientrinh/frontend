import { useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

/** Search form; submitting goes to `/search?q=`. Key it by the current query to reset it. */
export function SearchBar({ initialQuery = "" }: { initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery);
  const navigate = useNavigate();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    navigate(term ? `/search?q=${encodeURIComponent(term)}` : "/search");
  };
  return (
    <form role="search" onSubmit={submit} className="flex gap-2">
      <label htmlFor="store-search" className="sr-only">
        Search products
      </label>
      <input
        id="store-search"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search products, e.g. power bank"
        autoComplete="off"
        className="min-h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-base"
      />
      <button
        type="submit"
        className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        <Search size={16} aria-hidden="true" />
        Search
      </button>
    </form>
  );
}
