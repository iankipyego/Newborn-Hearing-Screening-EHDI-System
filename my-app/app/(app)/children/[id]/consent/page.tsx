"use client";
// app/(app)/children/[id]/consent/page.tsx
// Record or correct a patient's consent record. Was a 0-byte stub; the
// backend route it submits to (POST /api/v1/children/[id]/consent) is new
// too — see that route's file header for why.

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import { PatientIdentityBar } from "@/components/children/PatientIdentityBar";
import { ConsentUpsertSchema } from "@/lib/validation/schemas";

type ConsentFormValues = z.infer<typeof ConsentUpsertSchema>;

interface PatientSummary {
  id: string;
  research_id: string;
  hospital_number: string | null;
  child_name: string | null;
  date_of_birth: string;
  mother_name: string;
  consent_record: {
    status: "GIVEN" | "REFUSED" | "PENDING";
    consent_form_version: string;
    witness_name: string | null;
  } | null;
}

function authHeaders(): Record<string, string> {
  const token = document.cookie
    .split("; ")
    .find((row) => row.startsWith("access_token="))
    ?.split("=")[1];
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function ConsentPage({
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

  const methods = useForm<ConsentFormValues>({
    resolver: zodResolver(ConsentUpsertSchema),
    defaultValues: {
      consent_status: "PENDING",
      consent_form_version: "",
      witness_name: null,
    },
  });

  useEffect(() => {
    fetch(`/api/v1/patients/${id}`, { headers: authHeaders() })
      .then((r) => {
        if (!r.ok) throw new Error("Patient not found");
        return r.json();
      })
      .then((data) => {
        const p: PatientSummary = data.patient ?? data;
        setPatient(p);
        if (p.consent_record) {
          methods.reset({
            consent_status: p.consent_record.status,
            consent_form_version: p.consent_record.consent_form_version,
            witness_name: p.consent_record.witness_name,
          });
        }
      })
      .catch((e) => setServerError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onSubmit(values: ConsentFormValues) {
    setSubmitting(true);
    setServerError(null);
    try {
      const res = await fetch(`/api/v1/children/${id}/consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        setServerError(data.error ?? "Failed to save consent record");
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
        <h1 className="text-lg font-semibold text-gray-900 dark:text-fg">
          {patient.consent_record ? "Update Consent Record" : "Record Consent"}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-fg-muted">
          One consent record per child. Saving again updates the existing
          record rather than creating a second one.
        </p>
      </div>

      {success ? (
        <div className="rounded-lg border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-900/20 p-6 text-emerald-800 dark:text-emerald-300">
          Consent record saved. Taking you back to the child&apos;s profile…
        </div>
      ) : (
        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-5">
            {serverError && (
              <div className="rounded-lg border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-400">
                {serverError}
              </div>
            )}

            <Select
              id="consent_status"
              label="Consent status"
              required
              options={[
                { value: "GIVEN", label: "Given" },
                { value: "REFUSED", label: "Refused" },
                { value: "PENDING", label: "Pending" },
              ]}
            />

            <Input
              id="consent_form_version"
              label="Consent form version"
              required
              placeholder="e.g. IREC-v3.2"
              hint="Must match an approved IREC form version."
            />

            <Input
              id="witness_name"
              label="Witness name"
              placeholder="Optional"
            />

            <div className="pt-2">
              <Button type="submit" variant="primary" loading={submitting} className="w-full sm:w-auto">
                Save Consent Record
              </Button>
            </div>
          </form>
        </FormProvider>
      )}
    </div>
  );
}
