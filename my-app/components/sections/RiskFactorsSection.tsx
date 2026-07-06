'use client';

import { UseFormRegister, FieldErrors, UseFormWatch, UseFormSetValue } from 'react-hook-form';
import { PatientCreateInput  } from '@/lib/validation/schemas';
import { Checkbox } from '@/components/ui/Checkbox';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

interface RiskFactorsSectionProps {
  register: UseFormRegister<PatientCreateInput >;
  watch: UseFormWatch<PatientCreateInput >;
  setValue: UseFormSetValue<PatientCreateInput >;
  errors: FieldErrors<PatientCreateInput >;
  isSubmitting: boolean;
}

const FAMILY_HISTORY_DEGREE_OPTIONS = [
  { value: 'FIRST_DEGREE', label: 'First Degree (Parent/Sibling)' },
  { value: 'SECOND_DEGREE', label: 'Second Degree (Grandparent/Aunt/Uncle)' },
  { value: 'UNKNOWN', label: 'Unknown' },
];

const FAMILY_HISTORY_RELATION_OPTIONS = [
  { value: 'PARENT', label: 'Parent' },
  { value: 'SIBLING', label: 'Sibling' },
  { value: 'GRANDPARENT', label: 'Grandparent' },
  { value: 'OTHER', label: 'Other' },
];

export function RiskFactorsSection({
  register,
  watch,
  setValue,
  errors,
  isSubmitting,
}: RiskFactorsSectionProps) {
  const familyHistory = watch('riskFactors.family_history_hearing_loss');

  return (
    <Card padding="lg" shadow="none" border={false}>
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Section D: Risk Factors (JCIH 2019)</h3>
          <p className="text-sm text-gray-500 mt-1">
            Check all that apply. Some are auto-suggested from Section A.
          </p>
          <p className="text-xs text-teal-600 mt-1">
            ✓ Auto-suggested: NICU Admission, Prematurity (&lt;37wk), Birth Asphyxia (Apgar ≤6)
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Checkbox
            name="riskFactors.nicu_admission"
            label="NICU Admission (auto-suggested from Section A)"
            register={register}
            error={errors.riskFactors?.nicu_admission}
            disabled={isSubmitting}
          />

          <Checkbox
            name="riskFactors.prematurity_under_37wk"
            label="Prematurity Under 37wk (auto-suggested from GA)"
            register={register}
            error={errors.riskFactors?.prematurity_under_37wk}
            disabled={isSubmitting}
          />

          <Checkbox
            name="riskFactors.hyperbilirubinemia_treated"
            label="Hyperbilirubinemia Treated"
            register={register}
            error={errors.riskFactors?.hyperbilirubinemia_treated}
            disabled={isSubmitting}
          />

          <Checkbox
            name="riskFactors.ototoxic_drug_exposure"
            label="Ototoxic Drug Exposure"
            register={register}
            error={errors.riskFactors?.ototoxic_drug_exposure}
            disabled={isSubmitting}
          />

          <Checkbox
            name="riskFactors.craniofacial_anomaly"
            label="Craniofacial Anomaly"
            register={register}
            error={errors.riskFactors?.craniofacial_anomaly}
            disabled={isSubmitting}
          />

          <Checkbox
            name="riskFactors.family_history_hearing_loss"
            label="Family History Hearing Loss"
            register={register}
            error={errors.riskFactors?.family_history_hearing_loss}
            disabled={isSubmitting}
          />

          <Checkbox
            name="riskFactors.birth_asphyxia"
            label="Birth Asphyxia (auto-suggested from Apgar ≤6)"
            register={register}
            error={errors.riskFactors?.birth_asphyxia}
            disabled={isSubmitting}
          />

          <Checkbox
            name="riskFactors.congenital_infection_torch"
            label="Congenital Infection (TORCH)"
            register={register}
            error={errors.riskFactors?.congenital_infection_torch}
            disabled={isSubmitting}
          />

          <Checkbox
            name="riskFactors.syndrome_associated_with_hl"
            label="Syndrome Associated with HL"
            register={register}
            error={errors.riskFactors?.syndrome_associated_with_hl}
            disabled={isSubmitting}
          />

          <Checkbox
            name="riskFactors.mechanical_ventilation_over_5d"
            label="Mechanical Ventilation Over 5d"
            register={register}
            error={errors.riskFactors?.mechanical_ventilation_over_5d}
            disabled={isSubmitting}
          />

          <Checkbox
            name="riskFactors.bacterial_meningitis"
            label="Bacterial Meningitis"
            register={register}
            error={errors.riskFactors?.bacterial_meningitis}
            disabled={isSubmitting}
          />

          <Checkbox
            name="riskFactors.cytomegalovirus_cCMV"
            label="Congenital CMV (cCMV)"
            register={register}
            error={errors.riskFactors?.cytomegalovirus_cCMV}
            disabled={isSubmitting}
          />

          <Checkbox
            name="riskFactors.chemotherapy_exposure"
            label="Chemotherapy Exposure"
            register={register}
            error={errors.riskFactors?.chemotherapy_exposure}
            disabled={isSubmitting}
          />

          <Checkbox
            name="riskFactors.caregiver_concern_hearing"
            label="Caregiver Concern About Hearing"
            register={register}
            error={errors.riskFactors?.caregiver_concern_hearing}
            disabled={isSubmitting}
          />
        </div>

        {/* Family History Details - conditional */}
        {familyHistory && (
          <div className="border-t border-gray-200 pt-4 mt-2">
            <p className="text-sm font-medium text-gray-700 mb-3">Family History Details</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                name="riskFactors.family_history_degree"
                label="Family History Degree"
                options={FAMILY_HISTORY_DEGREE_OPTIONS}
                register={register}
                error={errors.riskFactors?.family_history_degree}
                disabled={isSubmitting}
              />

              <Select
                name="riskFactors.family_history_relation"
                label="Family History Relation"
                options={FAMILY_HISTORY_RELATION_OPTIONS}
                register={register}
                error={errors.riskFactors?.family_history_relation}
                disabled={isSubmitting}
              />
            </div>
          </div>
        )}

        <div className="border-t border-gray-200 pt-4">
          <Input
            name="riskFactors.additional_notes"
            label="Additional Notes"
            type="textarea"
            placeholder="Any additional clinical notes or observations..."
            register={register}
            error={errors.riskFactors?.additional_notes}
            disabled={isSubmitting}
            rows={3}
            helperText="Optional - free text, NOT exported as a coded variable"
          />
        </div>
      </div>
    </Card>
  );
}