import { useEffect, useState } from "react";

const KEY = "payment-balance-visible";
const EVENT = "payment-balance-visibility-change";

export function getBalanceVisibility() {
  return localStorage.getItem(KEY) === "true";
}

export function setBalanceVisibility(visible: boolean) {
  localStorage.setItem(KEY, String(visible));
  window.dispatchEvent(new Event(EVENT));
}

export function useBalanceVisibility() {
  const [visible, setVisible] = useState(getBalanceVisibility);
  useEffect(() => {
    const refresh = () => setVisible(getBalanceVisibility());
    window.addEventListener(EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return [visible, setBalanceVisibility] as const;
}
