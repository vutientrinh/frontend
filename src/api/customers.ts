import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
export function useCustomers() {
  return useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await api.GET("/customers");
      if (error) throw new Error(error.detail ?? "Could not load customers");
      return data;
    },
  });
}
