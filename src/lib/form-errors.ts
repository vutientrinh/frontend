import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import type { ProblemDetail } from "../api/types";
export function applyProblemErrors<T extends FieldValues>(
  problem: ProblemDetail,
  setError: UseFormSetError<T>,
): void {
  for (const error of problem.fieldErrors ?? [])
    setError(error.field as Path<T>, {
      type: "server",
      message: error.message,
    });
  if (!problem.fieldErrors?.length)
    setError("root.server", {
      type: "server",
      message: problem.detail ?? problem.title ?? "Request failed",
    });
}
