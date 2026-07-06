"use client";
// app/(app)/operational-logs/new/page.tsx
// Daily operational log entry — §4.9

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { OperationalLogCreateSchema } from "@/lib/validation/schemas";
import type { z } from "zod";

type FormData = z.infer<typeof OperationalLogCreateSchema>;

export default function Page() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(OperationalLogCreateSchema),
    defaultValues: {
      log_date: today,
      total_births: 0,
      total_screened: 0,
      total_missed: 0,
      missed_discharged_early: 0,
      missed_refused: 0,
      missed_equipment_down: 0,
      missed_staff_absent: 0,
      avg_screening_time_minutes: 0,
      equipment_downtime_minutes: 0,
      power_outage_minutes: 0,
      probes_replaced: 0,
      consumable_cost: 0,
      staff_on_duty_count: 0,
    },
  });

  const totalBirths = watch("total_births") ?? 0;
  const totalScreened = watch("total_screened") ?? 0;
  const totalMissed = watch("total_missed") ?? 0;
  const missedSum =
    (watch("missed_discharged_early") ?? 0) +
    (watch("missed_refused") ?? 0) +
    (watch("missed_equipment_down") ?? 0) +
    (watch("missed_staff_absent") ?? 0);
  const coveragePct = totalBirths > 0 ? Math.round((totalScreened / totalBirths) * 100) : 0;

  async function onSubmit(data: FormData) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/operational-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to save log");
      }
      router.push("/operational-logs");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setSubmitting(false);
    }
  }

  function Field({ label, name, type = "number", required = false, note }: {
    label: string;
    name: keyof FormData;
    type?: string;
    required?: boolean;
    note?: string;
  }) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        {note && <p className="text-xs text-gray-400 mb-1">{note}</p>}
        <input
          type={type}
          step={type === "number" ? "0.01" : undefined}
          min={type === "number" ? 0 : undefined}
          {...register(name, { valueAsNumber: type === "number" })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
        {errors[name] && (
          <p className="text-red-500 text-xs mt-1">{(errors[name] as { message?: string })?.message}</p>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Add Operational Log</h1>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8" noValidate>
        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Log Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            {...register("log_date")}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          {errors.log_date && <p className="text-red-500 text-xs mt-1">{errors.log_date.message}</p>}
        </div>

        {/* Volume */}
        <section>
          <h2 className="text-base font-semibold text-gray-800 mb-4 border-b pb-2">Volume</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Total live births" name="total_births" required />
            <Field label="Total screened" name="total_screened" required />
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Total missed <span className="text-red-500">*</span></label>
              <input
                type="number"
                min={0}
                {...register("total_missed", { valueAsNumber: true })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              {totalBirths > 0 && (
                <p className={`text-xs mt-1 font-medium ${coveragePct >= 95 ? "text-green-600" : "text-amber-600"}`}>
                  Coverage: {coveragePct}% (JCIH target: ≥95%)
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Missed breakdown — separate columns per §4.9, never free text */}
        <section>
          <h2 className="text-base font-semibold text-gray-800 mb-1 border-b pb-2">
            Missed Screening Reasons
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            Individual counts must add up to total missed ({totalMissed}).
            {missedSum !== totalMissed && totalMissed > 0 && (
              <span className="text-amber-600 font-medium"> Current sum: {missedSum} ≠ {totalMissed}</span>
            )}
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Discharged early" name="missed_discharged_early" />
            <Field label="Parent refused" name="missed_refused" />
            <Field label="Equipment down" name="missed_equipment_down" />
            <Field label="Staff absent" name="missed_staff_absent" />
          </div>
        </section>

        {/* Equipment & operations */}
        <section>
          <h2 className="text-base font-semibold text-gray-800 mb-4 border-b pb-2">Equipment & Operations</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Avg screening time (min)" name="avg_screening_time_minutes" />
            <Field label="Equipment downtime (min)" name="equipment_downtime_minutes" />
            <Field label="Power outage (min)" name="power_outage_minutes" />
            <Field label="Probes replaced" name="probes_replaced" />
            <Field label="Consumable cost (KES)" name="consumable_cost" />
            <Field label="Staff on duty" name="staff_on_duty_count" required />
          </div>
        </section>

        <div className="flex gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={() => router.push("/operational-logs")}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save Operational Log"}
          </button>
        </div>
      </form>
    </div>
  );
}
