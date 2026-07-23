"use client";
// app/(app)/children/[id]/risk-factors/page.tsx
// Record or correct a patient's risk-factor record. Was a 0-byte stub; the
// backend route it submits to (POST /api/v1/children/[id]/risk-factors) is
// new too — see that route's file header for why.

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Checkbox from "@/components/ui/Checkbox";
import Button from "@/components/ui/Button";
import { PatientIdentityBar } from "@/components/children/PatientIdentityBar";
import { RiskFactorUpsertSchema } from "@/lib/validation/schemas";

type RiskFactorFormValues = z.infer<typeof RiskFactorUpsertSchema>;

const RISK_FACTOR_CHECKBOXES: Array<{
  id: keyof RiskFactorFormValues;
  label: string;
}> = [
  { id: "risk_nicu_admission", label: "NICU admission" },
  { id: "risk_prematurity_under_37wk", label: "Prematurity (under 37 weeks)" },
  { id: "risk_hyperbilirubinemia_treated", label: "Hyperbilirubinemia requiring treatment" },
  { id: "risk_ototoxic_drug_exposure", label: "Ototoxic drug exposure" },
  { id: "risk_craniofacial_anomaly", label: "Craniofacial anomaly" },
  { id: "risk_family_history_hearing_loss", label: "Family history of hearing loss" },
  { id: "risk_birth_asphyxia", label: "Birth asphyxia" },
  { id: "risk_congenital_infection_torch", label: "Congenital infection (TORCH)" },
  { id: "risk_syndrome_associated_with_hl", label: "Syndrome associated with hearing loss" },
  { id: "risk_mechanical_ventilation_over_5d", label: "Mechanical ventilation over 5 days" },
  { id: "risk_bacterial_meningitis", label: "Bacterial meningitis" },
];

interface PatientSummary {
  id: string;
  research_id: string;
  hospital_number: string | null;
  child_name: string | null;
  date_of_birth: string;
  mother_name: string;
  risk_factors: {
    nicu_admission: boolean;
    prematurity_under_37wk: boolean;
    hyperbilirubinemia_treated: boolean;
    ototoxic_drug_exposure: boolean;
    craniofacial_anomaly: boolean;
    family_history_hearing_loss: boolean;
    birth_asphyxia: boolean;
    congenital_infection_torch: boolean;
    syndrome_associated_with_hl: boolean;
    mechanical_ventilation_over_5d: boolean;
    bacterial_meningitis: boolean;
    additional_notes: string | null;
  } | null;
}

function authHeaders(): Record<string, string> {
  const token = document.cookie
    .split("; ")
    .find((row) => row.startsWith("access_token="))
    ?.split("=")[1];
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function RiskFactorsPage({
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

  const methods = useForm<RiskFactorFormValues>({
    resolver: zodResolver(RiskFactorUpsertSchema),
    defaultValues: {
      risk_nicu_admission: false,
      risk_prematurity_under_37wk: false,
      risk_hyperbilirubinemia_treated: false,
      risk_ototoxic_drug_exposure: false,
      risk_craniofacial_anomaly: false,
      risk_family_history_hearing_loss: false,
      risk_birth_asphyxia: false,
      risk_congenital_infection_torch: false,
      risk_syndrome_associated_with_hl: false,
      risk_mechanical_ventilation_over_5d: false,
      risk_bacterial_meningitis: false,
      risk_additional_notes: "",
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
        const rf = p.risk_factors;
        if (rf) {
          methods.reset({
            risk_nicu_admission: rf.nicu_admission,
            risk_prematurity_under_37wk: rf.prematurity_under_37wk,
            risk_hyperbilirubinemia_treated: rf.hyperbilirubinemia_treated,
            risk_ototoxic_drug_exposure: rf.ototoxic_drug_exposure,
            risk_craniofacial_anomaly: rf.craniofacial_anomaly,
            risk_family_history_hearing_loss: rf.family_history_hearing_loss,
            risk_birth_asphyxia: rf.birth_asphyxia,
            risk_congenital_infection_torch: rf.congenital_infection_torch,
            risk_syndrome_associated_with_hl: rf.syndrome_associated_with_hl,
            risk_mechanical_ventilation_over_5d: rf.mechanical_ventilation_over_5d,
            risk_bacterial_meningitis: rf.bacterial_meningitis,
            risk_additional_notes: rf.additional_notes ?? "",
          });
        }
      })
      .catch((e) => setServerError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onSubmit(values: RiskFactorFormValues) {
    setSubmitting(true);
    setServerError(null);
    try {
      const res = await fetch(`/api/v1/children/${id}/risk-factors`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        setServerError(data.error ?? "Failed to save risk factors");
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
          {patient.risk_factors ? "Update Risk Factors" : "Record Risk Factors"}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-fg-muted">
          One record per child. Saving again updates the existing record
          rather than creating a second one.
        </p>
      </div>

      {success ? (
        <div className="rounded-lg border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-900/20 p-6 text-emerald-800 dark:text-emerald-300">
          Risk factors saved. Taking you back to the child&apos;s profile…
        </div>
      ) : (
        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-5">
            {serverError && (
              <div className="rounded-lg border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-400">
                {serverError}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-fg mb-2">
                Risk factors present (JCIH indicators)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {RISK_FACTOR_CHECKBOXES.map((rf) => (
                  <Checkbox key={rf.id} id={rf.id} label={rf.label} />
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="risk_additional_notes"
                className="block text-sm font-medium text-gray-700 dark:text-fg mb-1.5"
              >
                Additional notes
              </label>
              <textarea
                id="risk_additional_notes"
                rows={3}
                placeholder="Optional — free text, not used as a coded research variable"
                className="w-full px-3.5 py-2.5 rounded-lg text-sm border bg-white dark:bg-surface-card
                  text-gray-900 dark:text-fg placeholder-gray-400 dark:placeholder-fg-muted
                  border-gray-300 dark:border-surface-border
                  focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                {...methods.register("risk_additional_notes")}
              />
            </div>

            <div className="pt-2">
              <Button type="submit" variant="primary" loading={submitting} className="w-full sm:w-auto">
                Save Risk Factors
              </Button>
            </div>
          </form>
        </FormProvider>
      )}
    </div>
  );
}
