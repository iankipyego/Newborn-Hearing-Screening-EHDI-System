'use client';

import { UseFormRegister, FieldErrors, UseFormWatch, UseFormSetValue } from 'react-hook-form';
import { PatientCreateInput  } from '@/lib/validation/schemas';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Checkbox';
import { Card } from '@/components/ui/Card';

interface BabyInfoSectionProps {
  register: UseFormRegister<PatientCreateInput >;
  watch: UseFormWatch<PatientCreateInput >;
  setValue: UseFormSetValue<PatientCreateInput >;
  errors: FieldErrors<PatientCreateInput >;
  isSubmitting: boolean;
}

const SEX_OPTIONS = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
];

const DELIVERY_OPTIONS = [
  { value: 'NVD', label: 'Normal Vaginal Delivery' },
  { value: 'C_Section', label: 'Caesarean Section' },
  { value: 'Assisted_Vacuum_Forceps', label: 'Assisted (Vacuum/Forceps)' },
];

export function BabyInfoSection({
  register,
  watch,
  setValue,
  errors,
  isSubmitting,
}: BabyInfoSectionProps) {
  const nicuAdmitted = watch('baby.nicu_admitted');

  return (
    <Card padding="lg" shadow="none" border={false}>
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Section A: Baby Information</h3>
          <p className="text-sm text-gray-500 mt-1">Enter the newborn's clinical details</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Input
            name="baby.date_of_birth"
            label="Date/Time of Birth"
            type="datetime-local"
            required
            register={register}
            error={errors.baby?.date_of_birth}
            disabled={isSubmitting}
          />

          <Select
            name="baby.sex"
            label="Sex"
            options={SEX_OPTIONS}
            required
            register={register}
            error={errors.baby?.sex}
            disabled={isSubmitting}
          />

          <Input
            name="baby.birth_weight_grams"
            label="Birth Weight (g)"
            type="number"
            placeholder="e.g., 3200"
            required
            register={register}
            error={errors.baby?.birth_weight_grams}
            disabled={isSubmitting}
            helperText="Must be between 500g and 6000g"
          />

          <Input
            name="baby.gestational_age_weeks"
            label="Gestational Age (weeks)"
            type="number"
            placeholder="e.g., 38.5"
            required
            register={register}
            error={errors.baby?.gestational_age_weeks}
            disabled={isSubmitting}
            helperText="Must be between 22 and 44 weeks"
            step="0.5"
            min={22}
            max={44}
          />

          <Select
            name="baby.delivery_type"
            label="Delivery Type"
            options={DELIVERY_OPTIONS}
            required
            register={register}
            error={errors.baby?.delivery_type}
            disabled={isSubmitting}
          />

          <Input
            name="baby.apgar_score_5min"
            label="Apgar Score (5 minutes)"
            type="number"
            placeholder="e.g., 7"
            register={register}
            error={errors.baby?.apgar_score_5min}
            disabled={isSubmitting}
            helperText="Optional - must be between 0 and 10"
            min={0}
            max={10}
          />

          <Input
            name="baby.hospital_number"
            label="Hospital Number"
            type="text"
            placeholder="e.g., 12345"
            register={register}
            error={errors.baby?.hospital_number}
            disabled={isSubmitting}
            helperText="Optional - can be backfilled later"
          />

          <div className="space-y-3">
            <Checkbox
              name="baby.nicu_admitted"
              label="NICU Admitted"
              register={register}
              error={errors.baby?.nicu_admitted}
              disabled={isSubmitting}
            />

            {nicuAdmitted && (
              <Input
                name="baby.nicu_days"
                label="NICU Days"
                type="number"
                placeholder="e.g., 3"
                register={register}
                error={errors.baby?.nicu_days}
                disabled={isSubmitting}
                helperText="Required if NICU admitted. >5 days triggers AABR screening"
                min={0}
              />
            )}
          </div>
        </div>

        <div className="text-xs text-gray-400 border-t border-gray-100 pt-3">
          * Required fields
        </div>
      </div>
    </Card>
  );
}