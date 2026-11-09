import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { api } from "../../api/client";
import type { Customer, Product, ProblemDetail } from "../../api/types";
import { applyProblemErrors } from "../../lib/form-errors";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { FormField } from "../../components/shared";

const customerSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: z.string().trim().email("Enter a valid email"),
  phoneNumber: z.string().trim().min(1, "Phone number is required"),
});
const productSchema = z.object({
  productName: z.string().trim().min(1, "Product name is required"),
  productDescription: z.string().trim().min(1, "Description is required"),
  unitPrice: z
    .string()
    .regex(/^\d+(?:\.\d{1,4})?$/, "Enter a decimal with up to 4 places")
    .refine((v) => /[1-9]/.test(v), "Price must be positive"),
});
type Values = {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  productName: string;
  productDescription: string;
  unitPrice: string;
};
const blank: Values = {
  firstName: "",
  lastName: "",
  email: "",
  phoneNumber: "",
  productName: "",
  productDescription: "",
  unitPrice: "",
};
type Props = {
  kind: "customers" | "products";
  record: Customer | Product | null;
  open: boolean;
  onClose: () => void;
};
export function EntitySheet({ kind, record, open, onClose }: Props) {
  const client = useQueryClient(),
    customer = kind === "customers";
  const schema = customer
    ? customerSchema.extend({
        productName: z.string(),
        productDescription: z.string(),
        unitPrice: z.string(),
      })
    : productSchema.extend({
        firstName: z.string(),
        lastName: z.string(),
        email: z.string(),
        phoneNumber: z.string(),
      });
  const form = useForm<Values>({
    defaultValues: blank,
    resolver: zodResolver(schema),
  });
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = form;
  useEffect(() => {
    reset({ ...blank, ...record });
  }, [record, open, reset]);
  const mutation = useMutation({
    mutationFn: async (values: Values) => {
      if (customer) {
        const body = {
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          phoneNumber: values.phoneNumber,
        };
        const result = record
          ? await api.PUT("/customers/{id}", {
              params: { path: { id: record.id } },
              body,
            })
          : await api.POST("/customers", { body });
        if (result.error) throw result.error;
        return result.data;
      }
      const body = {
        productName: values.productName,
        productDescription: values.productDescription,
        unitPrice: values.unitPrice,
      };
      const result = record
        ? await api.PUT("/products/{id}", {
            params: { path: { id: record.id } },
            body,
          })
        : await api.POST("/products", { body });
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: [kind] });
      onClose();
    },
    onError: (error) => applyProblemErrors(error as ProblemDetail, setError),
  });
  const fields = customer
    ? (["firstName", "lastName", "email", "phoneNumber"] as const)
    : (["productName", "productDescription", "unitPrice"] as const);
  const labels: Record<keyof Values, string> = {
    firstName: "First name",
    lastName: "Last name",
    email: "Email address",
    phoneNumber: "Phone number",
    productName: "Product name",
    productDescription: "Description",
    unitPrice: "Unit price (VND)",
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !mutation.isPending) onClose();
      }}
    >
      <DialogContent
        aria-describedby="entity-description"
        className="left-auto right-0 top-0 flex h-[100dvh] w-full max-w-md translate-x-0 translate-y-0 flex-col overflow-y-auto rounded-none p-0"
      >
        <div className="flex items-start justify-between border-b border-border p-6">
          <div>
            <DialogTitle className="text-lg font-semibold">
              {record ? "Edit" : "New"} {customer ? "customer" : "product"}
            </DialogTitle>
            <DialogDescription
              id="entity-description"
              className="mt-1 text-sm text-muted-foreground"
            >
              {customer
                ? "Manage customer contact details."
                : "Add details to your product catalog."}
            </DialogDescription>
          </div>
          <button
            aria-label="Close"
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            className="rounded-md p-2 hover:bg-muted"
          >
            <X size={18} />
          </button>
        </div>
        <form
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="flex flex-1 flex-col"
        >
          <div className="flex-1 space-y-5 p-6">
            {errors.root?.server && (
              <p
                role="alert"
                className="rounded-md bg-muted p-3 text-sm text-destructive"
              >
                {errors.root.server.message}
              </p>
            )}
            {fields.map((field) => (
              <FormField
                key={field}
                id={field}
                label={labels[field]}
                error={errors[field]?.message}
              >
                <Input
                  {...register(field)}
                  autoFocus={field === fields[0]}
                  type={field === "email" ? "email" : "text"}
                  inputMode={field === "unitPrice" ? "decimal" : undefined}
                  placeholder={field === "unitPrice" ? "0.0000" : labels[field]}
                />
              </FormField>
            ))}
            {customer && (
              <p className="text-xs text-muted-foreground">
                All fields are required. Use the customer's current contact
                details.
              </p>
            )}
            {!customer && (
              <p className="text-xs text-muted-foreground">
                Use a positive decimal amount. The price is stored exactly.
              </p>
            )}
          </div>
          <div className="flex justify-end gap-3 border-t border-border p-6">
            <Button
              type="button"
              onClick={onClose}
              disabled={mutation.isPending}
              className="bg-muted text-foreground"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending
                ? "Saving…"
                : record
                  ? "Save changes"
                  : customer
                    ? "Create customer"
                    : "Create product"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
