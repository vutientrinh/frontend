import { Check, Lock } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Illustration } from "../../components/brand/Illustration";
import type { IllustrationName } from "../../components/brand/illustrations";
import { PageHeader } from "../../components/layout/Page";
import { ErrorState, FormField, StatusBadge } from "../../components/shared";
import { TableSkeleton } from "../../components/TableSkeleton";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Checkbox } from "../../components/ui/checkbox";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import {
  useOnboarding,
  useSaveOnboarding,
  useSubmitOnboarding,
} from "../commerce/api";
import type {
  Onboarding as Application,
  OnboardingStep,
  OnboardingSteps,
} from "../commerce/types";
import { ErrorText } from "./common";

const STEPS: [OnboardingStep, string][] = [
  ["shop", "Shop details"],
  ["owner", "Owner"],
  ["documents", "Business documents"],
  ["bank", "Bank account"],
  ["terms", "Terms"],
];

type FieldKind = "text" | "date" | "email" | "tel" | "file" | "files";
interface Field {
  name: string;
  label: string;
  kind?: FieldKind;
  optional?: boolean;
}

const FIELDS: Record<Exclude<OnboardingStep, "terms">, Field[]> = {
  shop: [
    { name: "shopName", label: "Shop name" },
    { name: "slug", label: "Shop URL" },
    { name: "description", label: "Description" },
    { name: "location", label: "Location" },
    { name: "contactPhone", label: "Contact phone", kind: "tel" },
    { name: "contactEmail", label: "Contact email", kind: "email" },
  ],
  owner: [
    { name: "fullName", label: "Owner full name" },
    { name: "dateOfBirth", label: "Date of birth", kind: "date" },
    { name: "idNumber", label: "ID number" },
    { name: "idFrontImage", label: "ID card, front", kind: "file" },
    { name: "idBackImage", label: "ID card, back", kind: "file" },
  ],
  documents: [
    { name: "businessType", label: "Business type" },
    {
      name: "businessRegistrationNo",
      label: "Registration number",
      optional: true,
    },
    { name: "taxCode", label: "Tax code", optional: true },
    {
      name: "documentNames",
      label: "Business documents",
      kind: "files",
      optional: true,
    },
  ],
  bank: [
    { name: "bankName", label: "Bank name" },
    { name: "accountNumber", label: "Account number" },
    { name: "accountHolder", label: "Account holder" },
  ],
};

/** The contract stores file names, so a chosen file is reduced to its name. */
function FileNameField({ field, saved }: { field: Field; saved: string }) {
  const [value, setValue] = useState(saved);
  const id = `onboarding-${field.name}`;
  return (
    <FormField
      id={id}
      label={field.label}
      required={!field.optional}
      hint={value ? `Selected: ${value}` : "No file selected."}
    >
      <input
        type="file"
        accept={field.kind === "file" ? "image/*" : undefined}
        multiple={field.kind === "files"}
        required={!field.optional && !value}
        onChange={(e) =>
          setValue(
            Array.from(e.target.files ?? [])
              .map((file) => file.name)
              .join(", ") || saved,
          )
        }
        data-value={value}
        name={field.name}
        className="block min-h-11 w-full rounded-md border border-input bg-background p-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-foreground"
      />
    </FormField>
  );
}

function StepForm({
  step,
  application,
  onSaved,
}: {
  step: OnboardingStep;
  application: Application;
  onSaved: (next: OnboardingStep) => void;
}) {
  const save = useSaveOnboarding();
  const saved = application.steps[step] as unknown as
    Record<string, unknown> | undefined;
  const title = STEPS.find(([key]) => key === step)![1];
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const values: Record<string, unknown> = Object.fromEntries(
      new FormData(form),
    );
    if (step === "terms") {
      delete values.accepted;
      values.acceptedCommissionPlan = "STANDARD_5";
      values.acceptedAt = new Date().toISOString();
    } else {
      for (const field of FIELDS[step]) {
        if (field.kind !== "file" && field.kind !== "files") continue;
        const input = form.elements.namedItem(field.name) as HTMLInputElement;
        const name = input.dataset.value ?? "";
        values[field.name] =
          field.kind === "files"
            ? name
                .split(",")
                .map((part) => part.trim())
                .filter(Boolean)
            : name;
      }
    }
    save.mutate(
      {
        step,
        data: values as unknown as NonNullable<OnboardingSteps[OnboardingStep]>,
      },
      { onSuccess: (result) => onSaved(result.currentStep) },
    );
  };
  const text = (name: string) => {
    const value = saved?.[name];
    return Array.isArray(value) ? value.join(", ") : String(value ?? "");
  };
  return (
    <Card className="p-5">
      <form onSubmit={onSubmit} className="grid gap-4">
        <h2 className="text-h3 font-semibold">{title}</h2>
        {step === "terms" ? (
          <Checkbox
            name="accepted"
            required
            defaultChecked={!!application.steps.terms}
            label="I accept the standard 5% commission plan."
          />
        ) : (
          FIELDS[step].map((field) =>
            field.kind === "file" || field.kind === "files" ? (
              <FileNameField
                key={field.name}
                field={field}
                saved={text(field.name)}
              />
            ) : (
              <FormField
                key={field.name}
                id={`onboarding-${field.name}`}
                label={field.label}
                required={!field.optional}
              >
                {field.name === "businessType" ? (
                  <Select
                    name={field.name}
                    defaultValue={text(field.name) || "INDIVIDUAL"}
                  >
                    <option value="INDIVIDUAL">Individual</option>
                    <option value="HOUSEHOLD">Household</option>
                    <option value="COMPANY">Company</option>
                  </Select>
                ) : (
                  <Input
                    name={field.name}
                    type={field.kind ?? "text"}
                    required={!field.optional}
                    defaultValue={text(field.name)}
                    className="min-h-11"
                  />
                )}
              </FormField>
            ),
          )
        )}
        <ErrorText error={save.error} />
        <Button
          type="submit"
          className="min-h-11 justify-self-start"
          disabled={save.isPending}
        >
          Save and continue
        </Button>
      </form>
    </Card>
  );
}

function StateCard({
  status,
  illustration,
  message,
}: {
  status: string;
  illustration: IllustrationName;
  message: string;
}) {
  return (
    <Card className="grid justify-items-center gap-3 p-8 text-center">
      <Illustration name={illustration} size="sm" />
      <StatusBadge status={status} />
      <p>{message}</p>
      <Button asChild variant="secondary" className="min-h-11">
        <Link to="/seller">Go to dashboard</Link>
      </Button>
    </Card>
  );
}

function Wizard({ application }: { application: Application }) {
  const submit = useSubmitOnboarding();
  const [chosen, setChosen] = useState<OnboardingStep>();
  const step = chosen ?? application.currentStep;
  const done = STEPS.filter(([key]) => key in application.steps).length;
  const complete = done === STEPS.length;
  return (
    <div className="space-y-5">
      {application.status === "REJECTED" ? (
        <div
          role="alert"
          className="grid justify-items-center gap-2 rounded-lg border border-destructive/40 p-5 text-center"
        >
          <Illustration name="error-generic" size="sm" />
          <StatusBadge status="REJECTED" />
          <p>
            {application.rejectionReason ?? "Your application was rejected."}
          </p>
          <p className="text-sm text-muted-foreground">
            Fix the steps below and submit again.
          </p>
        </div>
      ) : (
        done === 0 && <Illustration name="empty-seller-products" size="sm" />
      )}
      <div>
        <p className="mb-2 text-sm text-muted-foreground">
          {done} of {STEPS.length} steps complete
        </p>
        <progress
          aria-label="Onboarding progress"
          value={done}
          max={STEPS.length}
          className="mb-3 block h-2 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-primary"
        />
        <nav aria-label="Onboarding steps">
          <ol className="flex flex-wrap gap-2">
            {STEPS.map(([key, label], i) => {
              const completed = key in application.steps;
              // A step opens once every earlier step has been saved.
              const locked =
                !completed &&
                key !== application.currentStep &&
                !STEPS.slice(0, i).every(([k]) => k in application.steps);
              return (
                <li key={key}>
                  <button
                    type="button"
                    disabled={locked}
                    aria-current={step === key ? "step" : undefined}
                    onClick={() => setChosen(key)}
                    className={`inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50 ${step === key ? "border-primary font-semibold" : "border-border hover:bg-muted"}`}
                  >
                    {completed ? (
                      <Check
                        size={16}
                        className="text-success"
                        aria-hidden="true"
                      />
                    ) : locked ? (
                      <Lock size={14} aria-hidden="true" />
                    ) : (
                      <span className="tabular-nums">{i + 1}</span>
                    )}
                    {label}
                    {completed && <span className="sr-only">(complete)</span>}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      </div>
      <StepForm
        key={step}
        step={step}
        application={application}
        onSaved={setChosen}
      />
      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <p className="text-sm text-muted-foreground">
          {complete
            ? "All steps are complete."
            : "Complete all steps to submit your application."}
        </p>
        <Button
          variant={complete ? "primary" : "secondary"}
          className="min-h-11"
          onClick={() => submit.mutate(undefined)}
          disabled={!complete || submit.isPending}
        >
          Submit application
        </Button>
        <ErrorText error={submit.error} />
      </Card>
    </div>
  );
}

export function Onboarding() {
  const q = useOnboarding();
  return (
    <>
      <PageHeader
        title="Seller onboarding"
        description="Complete and save each step before submitting your shop."
      />
      {q.isError ? (
        <ErrorState retry={() => void q.refetch()} />
      ) : !q.data ? (
        <TableSkeleton rows={5} columns={1} label="Loading your application" />
      ) : q.data.status === "APPROVED" ? (
        <StateCard
          status="APPROVED"
          illustration="success-order"
          message="Your shop is approved."
        />
      ) : q.data.status === "UNDER_REVIEW" ? (
        <StateCard
          status="UNDER_REVIEW"
          illustration="empty-queue"
          message="Your application is under review."
        />
      ) : (
        <Wizard application={q.data} />
      )}
    </>
  );
}
