import { Link } from "react-router-dom";
import { useCategories } from "../../commerce/api";

/**
 * "Shop / Parent / Category" (TASK-034 §6: products now sit on leaf sub-categories, so the parent must show).
 * The parent comes from the cached category list; until it loads, the trail is "Shop / Category".
 * `current` marks the last crumb as the page itself (category page) instead of a link (product page).
 */
export function CategoryBreadcrumb({
  slug,
  name,
  current = false,
}: {
  slug: string;
  name: string;
  current?: boolean;
}) {
  const { data = [] } = useCategories();
  const category = data.find((c) => c.slug === slug);
  const parent = category?.parentId
    ? data.find((c) => c.id === category.parentId)
    : undefined;
  const link = "hover:underline";
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-x-1">
        <li>
          <Link to="/" className={link}>
            Shop
          </Link>
        </li>
        {parent && (
          <li>
            <span aria-hidden="true">/ </span>
            <Link to={`/c/${parent.slug}`} className={link}>
              {parent.name}
            </Link>
          </li>
        )}
        <li>
          <span aria-hidden="true">/ </span>
          {current ? (
            <span aria-current="page">{name}</span>
          ) : (
            <Link to={`/c/${slug}`} className={link}>
              {name}
            </Link>
          )}
        </li>
      </ol>
    </nav>
  );
}
