import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { logout, restoreSession, setSession } from "./client";
import type { Tokens, User } from "./types";
type State = {
  user: User | null;
  loading: boolean;
  signIn: (t: Tokens) => void;
  signOut: () => Promise<void>;
  setUser: (u: User) => void;
};
const Context = createContext<State | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void restoreSession().then((u) => {
      if (active) {
        setUser(u);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);
  return (
    <Context.Provider
      value={{
        user,
        loading,
        signIn: (t) => {
          client.clear();
          setSession(t);
          setUser(t.user);
        },
        signOut: async () => {
          try {
            await logout();
          } finally {
            client.clear();
            setUser(null);
          }
        },
        setUser,
      }}
    >
      {children}
    </Context.Provider>
  );
}
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error("Missing auth provider");
  return value;
}
// eslint-disable-next-line react-refresh/only-export-components
export function useOptionalAuth() {
  return useContext(Context);
}
