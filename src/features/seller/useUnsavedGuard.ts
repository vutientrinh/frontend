import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/**
 * While `active`, warns before the tab closes and holds back in-app link clicks: `onBlocked`
 * receives the destination so the page can ask before leaving.
 */
export function useUnsavedGuard(
  active: boolean,
  onBlocked: (to: string) => void,
) {
  const location = useLocation();
  const blocked = useRef(onBlocked);
  useEffect(() => {
    blocked.current = onBlocked;
  });
  useEffect(() => {
    if (!active) return;
    const preventClose = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const guardLinkNavigation = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (
        (anchor.target && anchor.target !== "_self") ||
        anchor.hasAttribute("download") ||
        anchor.origin !== window.location.origin
      )
        return;
      const destination = new URL(anchor.href);
      if (
        destination.pathname === location.pathname &&
        destination.search === location.search
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      blocked.current(
        `${destination.pathname}${destination.search}${destination.hash}`,
      );
    };
    window.addEventListener("beforeunload", preventClose);
    document.addEventListener("click", guardLinkNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", preventClose);
      document.removeEventListener("click", guardLinkNavigation, true);
    };
  }, [active, location.pathname, location.search]);
}
