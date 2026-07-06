'use client';

import { UseFormRegister, FieldErrors, UseFormWatch, UseFormSetValue } from 'react-hook-form';
import { PatientCreateInput  } from '@/lib/validation/schemas';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

interface ConsentSectionProps {
  register: UseFormRegister<PatientCreateInput >;
  watch: UseFormWatch<PatientCreateInput >;
  setValue: UseFormSetValue<PatientCreateInput >;
  errors: FieldErrors<PatientCreateInput >;
  isSubmitting: boolean;
}

const CONSENT_STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'GIVEN', label: 'Given' },
  { value: 'REFUSED', label: 'Refused' },
];

const CONSENT_VERSION_OPTIONS = [
  { value: 'MRH-EHDI-consent-v1.0', label: 'MRH-EHDI-consent-v1.0' },
];

export function ConsentSection({
  register,
  watch,
  setValue,
  errors,
  isSubmitting,
}: ConsentSectionProps) {
  const consentStatus = watch('consent.status');

  return (
    <Card padding="lg" shadow="none" border={false}>
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Section C: Consent</h3>
          <p className="text-sm text-gray-500 mt-1">
            Record the mother's consent for research data collection
          </p>
          <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              ⚠️ <strong>Hard Gate:</strong> If consent is <strong>REFUSED</strong>, 
              Sections D (Risk Factors) and E (Parent Survey) will be hidden. 
              Only demographics and consent refusal will be saved.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Select
            name="consent.status"
            label="Consent Status"
            options={CONSENT_STATUS_OPTIONS}
            required
            register={register}
            error={errors.consent?.status}
            disabled={isSubmitting}
          />

          <Select
            name="consent.consent_form_version"
            label="Consent Form Version"
            options={CONSENT_VERSION_OPTIONS}
            register={register}
            error={errors.consent?.consent_form_version}
            disabled={isSubmitting || consentStatus !== 'GIVEN'}
            helperText={consentStatus === 'GIVEN' ? 'Required when consent is given' : 'Not required'}
          />

          <Input
            name="consent.witness_name"
            label="Witness Name"
            type="text"
            placeholder="e.g., Jane Doe"
            register={register}
            error={errors.consent?.witness_name}
            disabled={isSubmitting || consentStatus !== 'GIVEN'}
            helperText={consentStatus === 'GIVEN' ? 'Optional - some IRBs require this' : 'Not required'}
          />
        </div>

        <div className="text-xs text-gray-400 border-t border-gray-100 pt-3">
          * Required fields
        </div>
      </div>
    </Card>
  );
}