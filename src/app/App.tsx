import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AppShell } from "./AppShell";
import { Placeholder } from "../components/Placeholder";
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
});
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Placeholder title="Dashboard" />} />
          {[
            ["customers", "Customers"],
            ["products", "Products"],
            ["orders", "Orders"],
            ["orders/new", "Create order"],
            ["orders/:id", "Order detail"],
            ["payments", "Payments"],
            ["payments/new", "Create payment"],
            ["payments/:id", "Payment detail"],
            ["events", "Event monitor"],
            ["*", "Page not found"],
          ].map(([path, title]) => (
            <Route
              key={path}
              path={path}
              element={<Placeholder title={title} />}
            />
          ))}
        </Route>
      </Routes>
      <Toaster />
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
