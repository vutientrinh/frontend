import type { Address } from "../../features/banking/types";
type BankUser = {
  id: string;
  phone: string;
  fullName: string;
  roles: string[];
  status: string;
};
type BankStorage = {
  users: BankUser[];
  sessions: Record<string, string>;
  addresses: Record<string, Address[]>;
};
export function bankingData(): BankStorage | undefined {
  try {
    const raw = localStorage.getItem("payment-banking-mock-v3");
    return raw ? (JSON.parse(raw) as BankStorage) : undefined;
  } catch {
    return undefined;
  }
}
export function identity(request: Request): BankUser | undefined {
  const token = /^Bearer (.+)$/.exec(
    request.headers.get("Authorization") ?? "",
  )?.[1];
  const db = bankingData();
  const user = db?.users.find((u) => u.id === db.sessions[token ?? ""]);
  return user?.status === "ACTIVE" ? user : undefined;
}
