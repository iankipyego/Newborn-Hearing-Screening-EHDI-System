'use client';

import { UseFormRegister, FieldErrors, UseFormWatch, UseFormSetValue } from 'react-hook-form';
import { PatientCreateInput  } from '@/lib/validation/schemas';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

interface MotherInfoSectionProps {
  register: UseFormRegister<PatientCreateInput >;
  watch: UseFormWatch<PatientCreateInput >;
  setValue: UseFormSetValue<PatientCreateInput >;
  errors: FieldErrors<PatientCreateInput >;
  isSubmitting: boolean;
}

export function MotherInfoSection({
  register,
  watch,
  setValue,
  errors,
  isSubmitting,
}: MotherInfoSectionProps) {
  return (
    <Card padding="lg" shadow="none" border={false}>
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Section B: Mother/Guardian Information</h3>
          <p className="text-sm text-gray-500 mt-1">Enter the mother's or primary guardian's details</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Input
            name="mother.mother_name"
            label="Mother's Full Name"
            type="text"
            placeholder="e.g., Mary Wanjiku"
            required
            register={register}
            error={errors.mother?.mother_name}
            disabled={isSubmitting}
          />

          <Input
            name="mother.mother_age"
            label="Mother's Age"
            type="number"
            placeholder="e.g., 28"
            required
            register={register}
            error={errors.mother?.mother_age}
            disabled={isSubmitting}
            min={10}
            max={60}
          />

          <Input
            name="mother.mother_phone"
            label="Primary Phone Number"
            type="tel"
            placeholder="e.g., 0712345678 or +254712345678"
            required
            register={register}
            error={errors.mother?.mother_phone}
            disabled={isSubmitting}
            helperText="Kenyan format: 0712345678 or +254712345678"
          />

          <Input
            name="mother.guardian_phone_alt"
            label="Alternative/Guardian Phone"
            type="tel"
            placeholder="e.g., 0712345678"
            register={register}
            error={errors.mother?.guardian_phone_alt}
            disabled={isSubmitting}
            helperText="Optional"
          />

          <Input
            name="mother.whatsapp_number"
            label="WhatsApp Number"
            type="tel"
            placeholder="e.g., 0712345678"
            register={register}
            error={errors.mother?.whatsapp_number}
            disabled={isSubmitting}
            helperText="Optional - may differ from primary phone"
          />

          <Input
            name="mother.email"
            label="Email Address"
            type="email"
            placeholder="e.g., mother@example.com"
            register={register}
            error={errors.mother?.email}
            disabled={isSubmitting}
            helperText="Optional"
          />

          <Input
            name="mother.residence_county"
            label="Residence County"
            type="text"
            placeholder="e.g., Nairobi"
            required
            register={register}
            error={errors.mother?.residence_county}
            disabled={isSubmitting}
          />

          <Input
            name="mother.residence_subcounty"
            label="Residence Sub-County"
            type="text"
            placeholder="e.g., Dagoretti"
            required
            register={register}
            error={errors.mother?.residence_subcounty}
            disabled={isSubmitting}
          />

          <Input
            name="mother.nearest_town"
            label="Nearest Town"
            type="text"
            placeholder="e.g., Kawangware"
            required
            register={register}
            error={errors.mother?.nearest_town}
            disabled={isSubmitting}
          />
        </div>

        <div className="text-xs text-gray-400 border-t border-gray-100 pt-3">
          * Required fields
        </div>
      </div>
    </Card>
  );
}