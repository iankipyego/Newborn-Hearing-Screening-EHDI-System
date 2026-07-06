'use client';

import { UseFormRegister, FieldErrors, UseFormWatch, UseFormSetValue } from 'react-hook-form';
import { PatientCreateInput  } from '@/lib/validation/schemas';
import { Select } from '@/components/ui/Select';
import { RadioGroup } from '@/components/ui/RadioGroup';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

interface ParentSurveySectionProps {
  register: UseFormRegister<PatientCreateInput >;
  watch: UseFormWatch<PatientCreateInput >;
  setValue: UseFormSetValue<PatientCreateInput >;
  errors: FieldErrors<PatientCreateInput >;
  isSubmitting: boolean;
}

const CHANNEL_OPTIONS = [
  { value: 'IN_PERSON', label: 'In Person (administer now)' },
  { value: 'SMS', label: 'SMS (send after discharge)' },
  { value: 'WHATSAPP', label: 'WhatsApp (send after discharge)' },
];

const SCORE_OPTIONS = [
  { value: 1, label: '1 - Poor' },
  { value: 2, label: '2 - Fair' },
  { value: 3, label: '3 - Good' },
  { value: 4, label: '4 - Very Good' },
  { value: 5, label: '5 - Excellent' },
];

const YES_NO_OPTIONS = [
  { value: true, label: 'Yes' },
  { value: false, label: 'No' },
];

const YES_NO_UNSURE_OPTIONS = [
  { value: true, label: 'Yes' },
  { value: false, label: 'No' },
  { value: 'unsure' as any, label: 'Unsure' },
];

export function ParentSurveySection({
  register,
  watch,
  setValue,
  errors,
  isSubmitting,
}: ParentSurveySectionProps) {
  const channelPreference = watch('survey.delivery_channel_preference');
  const isInPerson = channelPreference === 'IN_PERSON';

  return (
    <Card padding="lg" shadow="none" border={false}>
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Section E: Parent Survey</h3>
          <p className="text-sm text-gray-500 mt-1">
            Satisfaction and knowledge questionnaire for the parent
          </p>
          <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              💡 <strong>Channel Preference:</strong> If SMS or WhatsApp is selected, 
              the survey will be sent after discharge. If In Person is selected, 
              the clerk administers it now.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Select
            name="survey.delivery_channel_preference"
            label="Delivery Channel Preference"
            options={CHANNEL_OPTIONS}
            required
            register={register}
            error={errors.survey?.delivery_channel_preference}
            disabled={isSubmitting}
          />

          {/* Only show score fields if IN_PERSON is selected */}
          {isInPerson ? (
            <>
              <div className="col-span-1 md:col-span-2">
                <p className="text-sm font-medium text-gray-700 mb-3">
                  1-5 Scale: <span className="font-normal text-gray-500">1 = Poor, 5 = Excellent</span>
                </p>
              </div>

              <RadioGroup
                name="survey.explanation_clarity_score"
                label="Explanation Clarity"
                options={SCORE_OPTIONS}
                register={register}
                error={errors.survey?.explanation_clarity_score}
                disabled={isSubmitting}
                direction="row"
              />

              <RadioGroup
                name="survey.anxiety_before_score"
                label="Anxiety Before Test"
                options={SCORE_OPTIONS}
                register={register}
                error={errors.survey?.anxiety_before_score}
                disabled={isSubmitting}
                direction="row"
              />

              <RadioGroup
                name="survey.anxiety_after_score"
                label="Anxiety After Test"
                options={SCORE_OPTIONS}
                register={register}
                error={errors.survey?.anxiety_after_score}
                disabled={isSubmitting}
                direction="row"
              />

              <RadioGroup
                name="survey.satisfaction_score"
                label="Overall Satisfaction"
                options={SCORE_OPTIONS}
                register={register}
                error={errors.survey?.satisfaction_score}
                disabled={isSubmitting}
                direction="row"
              />

              <RadioGroup
                name="survey.would_recommend"
                label="Would you recommend this screening to other parents?"
                options={YES_NO_OPTIONS}
                register={register}
                error={errors.survey?.would_recommend}
                disabled={isSubmitting}
                direction="row"
              />

              <RadioGroup
                name="survey.understood_result"
                label="Did you understand the screening result?"
                options={YES_NO_OPTIONS}
                register={register}
                error={errors.survey?.understood_result}
                disabled={isSubmitting}
                direction="row"
              />

              <RadioGroup
                name="survey.knowledge_q1_correct"
                label="Knowledge Question 1: Do you know when to return for follow-up?"
                options={YES_NO_UNSURE_OPTIONS}
                register={register}
                error={errors.survey?.knowledge_q1_correct}
                disabled={isSubmitting}
                direction="row"
              />

              <RadioGroup
                name="survey.knowledge_q2_correct"
                label="Knowledge Question 2: Do you know the signs of hearing loss?"
                options={YES_NO_UNSURE_OPTIONS}
                register={register}
                error={errors.survey?.knowledge_q2_correct}
                disabled={isSubmitting}
                direction="row"
              />

              <Input
                name="survey.open_comments"
                label="Open Comments"
                type="textarea"
                placeholder="Any additional feedback from the parent..."
                register={register}
                error={errors.survey?.open_comments}
                disabled={isSubmitting}
                rows={3}
                helperText="Optional - free text, sanitised before storage"
              />
            </>
          ) : (
            <div className="col-span-1 md:col-span-2 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-600">
                📱 Survey will be sent via {channelPreference === 'SMS' ? 'SMS' : 'WhatsApp'} after discharge.
                Scores will be collected when the parent responds.
              </p>
            </div>
          )}
        </div>

        <div className="text-xs text-gray-400 border-t border-gray-100 pt-3">
          * Required fields
        </div>
      </div>
    </Card>
  );
}