"use client";
// app/(app)/children/[id]/referrals/new/page.tsx
// Manually record a referral. Was a 0-byte stub; ReferralCreateSchema
// already existed in lib/validation/schemas.ts but had no route wired to
// it — POST /api/v1/children/[id]/referrals (new) is that missing route.
// See that route's file header for why it does not run the pathway engine.

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import { PatientIdentityBar } from "@/components/children/PatientIdentityBar";
import { ReferralCreateSchema } from "@/lib/validation/schemas";

type ReferralFormValues = z.input<typeof ReferralCreateSchema>;

interface PatientSummary {
  id: string;
  research_id: string;
  hospital_number: string | null;
  child_name: string | null;
  date_of_birth: string;
  mother_name: string;
}

function authHeaders(): Record<string, string> {
  const token = document.cookie
    .split("; ")
    .find((row) => row.startsWith("access_token="))
    ?.split("=")[1];
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function NewReferralPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [patient, setPatient] = useState<PatientSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const methods = useForm<ReferralFormValues>({
    resolver: zodResolver(ReferralCreateSchema),
    defaultValues: {
      ear: "LEFT",
      type: "HEALTH_CARE_PROVIDER",
      reason: "",
      provider_name: "",
      facility: "",
      status: "PENDING",
      diagnosis_at_referral: null,
      treatment_given: null,
      medical_clearance_given: null,
      pe_tube_placed: null,
    },
  });

  const referralType = methods.watch("type");
  const status = methods.watch("status");

  useEffect(() => {
    fetch(`/api/v1/patients/${id}`, { headers: authHeaders() })
      .then((r) => {
        if (!r.ok) throw new Error("Patient not found");
        return r.json();
      })
      .then((data) => setPatient(data.patient ?? data))
      .catch((e) => setServerError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onSubmit(values: ReferralFormValues) {
    setSubmitting(true);
    setServerError(null);
    try {
      const res = await fetch(`/api/v1/children/${id}/referrals`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        setServerError(data.error ?? "Failed to save referral");
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push(`/children/${id}`), 900);
    } catch {
      setServerError("Network error — please try again");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 dark:border-surface-border border-t-accent" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="rounded-lg border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">
          {serverError ?? "Patient not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-10 space-y-6">
      <PatientIdentityBar patient={patient} />

      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-fg">Add Referral</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-fg-muted">
          For a referral this system didn&apos;t create automatically — e.g.
          catching up a paper record, or an ad-hoc referral outside the
          usual Screen 2 / rescreen path.
        </p>
      </div>

      <Alert variant="info">
        This won&apos;t change the ear&apos;s pathway status on its own —
        that only moves when a screening result or visual inspection
        triggers it. This just adds the referral to the record.
      </Alert>

      {success ? (
        <div className="rounded-lg border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-900/20 p-6 text-emerald-800 dark:text-emerald-300">
          Referral saved. Taking you back to the child&apos;s profile…
        </div>
      ) : (
        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-5">
            {serverError && (
              <div className="rounded-lg border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-400">
                {serverError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                id="ear"
                label="Ear"
                required
                options={[
                  { value: "LEFT", label: "Left" },
                  { value: "RIGHT", label: "Right" },
                ]}
              />
              <Select
                id="type"
                label="Referral type"
                required
                options={[
                  { value: "HEALTH_CARE_PROVIDER", label: "Health care provider" },
                  { value: "AUDIOLOGIST", label: "Audiologist" },
                ]}
              />
            </div>

            <div>
              <label htmlFor="reason" className="block text-sm font-medium text-gray-700 dark:text-fg mb-1.5">
                Reason <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <textarea
                id="reason"
                rows={2}
                placeholder="e.g. Screen 2 NOT_PASS, entered from paper record"
                className="w-full px-3.5 py-2.5 rounded-lg text-sm border bg-white dark:bg-surface-card
                  text-gray-900 dark:text-fg placeholder-gray-400 dark:placeholder-fg-muted
                  border-gray-300 dark:border-surface-border
                  focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                {...methods.register("reason")}
              />
              {methods.formState.errors.reason && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {methods.formState.errors.reason.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input id="provider_name" label="Provider name" required placeholder="e.g. Dr. Otieno, or “To be assigned”" />
              <Input id="facility" label="Facility" required placeholder="e.g. Mama Rachel Hospital ENT clinic" />
            </div>

            <Select
              id="status"
              label="Status"
              required
              options={[
                { value: "PENDING", label: "Pending" },
                { value: "CLEARED", label: "Cleared" },
                { value: "TREATED", label: "Treated" },
                { value: "SEEN", label: "Seen (PE tube placed)" },
                { value: "NO_SHOW", label: "No-show" },
              ]}
            />

            {referralType === "HEALTH_CARE_PROVIDER" && status !== "PENDING" && (
              <Select
                id="diagnosis_at_referral"
                label="Diagnosis at referral"
                options={[
                  { value: "Otitis_media", label: "Otitis media" },
                  { value: "Blockage", label: "Blockage" },
                  { value: "Infection", label: "Infection" },
                  { value: "Clear", label: "Clear" },
                  { value: "Other", label: "Other" },
                ]}
              />
            )}

            {status !== "PENDING" && (
              <Input
                id="treatment_given"
                label="Treatment given"
                placeholder="Optional"
              />
            )}

            {status === "SEEN" && (
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-fg">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 dark:border-surface-border accent-teal-600 dark:accent-teal-500"
                  {...methods.register("pe_tube_placed")}
                />
                PE tube placed
              </label>
            )}

            <div className="pt-2">
              <Button type="submit" variant="primary" loading={submitting} className="w-full sm:w-auto">
                Save Referral
              </Button>
            </div>
          </form>
        </FormProvider>
      )}
    </div>
  );
}
