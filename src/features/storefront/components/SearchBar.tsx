import { useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

/**
 * Search form; submitting goes to `/search?q=`. Without `initialQuery` it mirrors the current
 * `/search?q=` (the shopper header's box shows what the results page is for, and clears
 * elsewhere), so the results page needs no second search box.
 */
export function SearchBar({
  initialQuery,
  id = "store-search",
}: {
  initialQuery?: string;
  id?: string;
}) {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const urlQuery = pathname === "/search" ? (params.get("q") ?? "") : "";
  const [q, setQ] = useState(initialQuery ?? urlQuery);
  // Follow the URL when it changes (back/forward, a category link), keeping what the user types.
  const [seenUrlQuery, setSeenUrlQuery] = useState(urlQuery);
  if (initialQuery === undefined && seenUrlQuery !== urlQuery) {
    setSeenUrlQuery(urlQuery);
    setQ(urlQuery);
  }
  const navigate = useNavigate();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    navigate(term ? `/search?q=${encodeURIComponent(term)}` : "/search");
  };
  return (
    <form role="search" onSubmit={submit} className="flex gap-2">
      <label htmlFor={id} className="sr-only">
        Search products
      </label>
      <input
        id={id}
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
