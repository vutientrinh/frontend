import { useLocation } from "react-router-dom";
import {
  useCampaigns,
  useCategoryPreview,
  useCategoryTree,
} from "../../../commerce/api";
import type {
  Campaign,
  Category,
  CategoryTreeItem,
} from "../../../commerce/types";

/*
 * Data for the Categories menu (TASK-034 Part B). This file is the only place that knows where the data comes
 * from: fe-dev-2's `useCategoryTree()` (2 levels, array order = display order, `productCount`) and
 * `useCategoryPreview(slug)` (4 best sellers, cached 5 min). The components only see these shapes.
 */

export type MenuCategory = Category;
export type CategoryNode = CategoryTreeItem;

export function useMenuCategories() {
  const query = useCategoryTree();
  return {
    tree: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    retry: () => void query.refetch(),
  };
}

/** Up to 4 best-selling products of a category (a top level includes its children). Mount = fetch. */
export function useMenuPreview(slug: string) {
  return useCategoryPreview(slug);
}

/** The campaign whose CTA leads to this category (`/search?category=<slug>` or `/c/<slug>`), if any. */
export function useCategoryCampaign(slug: string): Campaign | undefined {
  const { data } = useCampaigns();
  return data?.find((c) => {
    const url = new URL(c.href, "https://shop.invalid");
    return (
      url.pathname === `/c/${slug}` ||
      (url.pathname === "/search" && url.searchParams.get("category") === slug)
    );
  });
}

/** Category slug of the current route: `/c/:slug` or `/search?category=`. */
export function useRouteCategorySlug(): string | undefined {
  const { pathname, search } = useLocation();
  const match = /^\/c\/([^/]+)/.exec(pathname);
  if (match) return decodeURIComponent(match[1]);
  if (pathname === "/search")
    return new URLSearchParams(search).get("category") ?? undefined;
  return undefined;
}

/** Index of the top-level category to open with: the route's category (or its parent), else the first. */
export function initialIndex(tree: CategoryNode[], routeSlug?: string) {
  if (!routeSlug) return 0;
  const i = tree.findIndex(
    (top) =>
      top.slug === routeSlug || top.children.some((c) => c.slug === routeSlug),
  );
  return Math.max(i, 0);
}
