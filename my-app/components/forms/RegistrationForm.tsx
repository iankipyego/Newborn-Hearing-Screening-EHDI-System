'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { PatientCreateSchema, PatientCreateInput } from '@/lib/validation/schemas';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Toast } from '@/components/ui/Toast';
import { BabyInfoSection } from '@/components/sections/BabyInfoSection';
import { MotherInfoSection } from '@/components/sections/MotherInfoSection';
import { ConsentSection } from '@/components/sections/ConsentSection';
import { RiskFactorsSection } from '@/components/sections/RiskFactorsSection';
import { ParentSurveySection } from '@/components/sections/ParentSurveySection';

interface ToastState {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

export function RegistrationForm() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [researchId, setResearchId] = useState('');
  const [patientId, setPatientId] = useState('');
  const [toast, setToast] = useState<ToastState | null>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
    trigger,
    getValues,
  } = useForm<PatientCreateInput>({
    resolver: zodResolver(PatientCreateSchema),
    defaultValues: {
      baby: {
        nicu_admitted: false,
      },
      consent: {
        status: 'PENDING',
      },
      riskFactors: {
        nicu_admission: false,
        prematurity_under_37wk: false,
        hyperbilirubinemia_treated: false,
        ototoxic_drug_exposure: false,
        craniofacial_anomaly: false,
        family_history_hearing_loss: false,
        birth_asphyxia: false,
        congenital_infection_torch: false,
        syndrome_associated_with_hl: false,
        mechanical_ventilation_over_5d: false,
        bacterial_meningitis: false,
        cytomegalovirus_cCMV: false,
        chemotherapy_exposure: false,
        caregiver_concern_hearing: false,
      },
    },
    mode: 'onChange',
  });

  // Watch fields for conditional logic
  const gestationalAge = watch('baby.gestational_age_weeks');
  const apgarScore = watch('baby.apgar_score_5min');
  const nicuAdmitted = watch('baby.nicu_admitted');
  const consentStatus = watch('consent.status');

  // Auto-suggestion: Prematurity
  useEffect(() => {
    if (gestationalAge !== undefined && gestationalAge < 37) {
      setValue('riskFactors.prematurity_under_37wk', true);
    }
  }, [gestationalAge, setValue]);

  // Auto-suggestion: Birth Asphyxia
  useEffect(() => {
    if (apgarScore !== undefined && apgarScore !== null && apgarScore <= 6) {
      setValue('riskFactors.birth_asphyxia', true);
    }
  }, [apgarScore, setValue]);

  // Auto-suggestion: NICU Admission
  useEffect(() => {
    setValue('riskFactors.nicu_admission', nicuAdmitted);
  }, [nicuAdmitted, setValue]);

  const steps = [
    { id: 'baby', label: 'Baby Info', component: BabyInfoSection },
    { id: 'mother', label: 'Mother Info', component: MotherInfoSection },
    { id: 'consent', label: 'Consent', component: ConsentSection },
    { id: 'risk', label: 'Risk Factors', component: RiskFactorsSection },
    { id: 'survey', label: 'Parent Survey', component: ParentSurveySection },
  ];

  // Skip risk and survey if consent is REFUSED
  const visibleSteps = consentStatus === 'REFUSED'
    ? steps.slice(0, 3)
    : steps;

  const getFieldsForStep = (stepIndex: number): (keyof PatientCreateInput )[] => {
    const stepMap: Record<string, (keyof PatientCreateInput )[]> = {
      baby: ['baby'],
      mother: ['mother'],
      consent: ['consent'],
      risk: ['riskFactors'],
      survey: ['survey'],
    };
    const step = visibleSteps[stepIndex];
    return stepMap[step.id] || [];
  };

  const onSubmit = async (data: PatientCreateInput ) => {
    setIsSubmitting(true);
    setToast(null);

    try {
      // Convert date to ISO string for API
      const payload = {
        ...data,
        baby: {
          ...data.baby,
          date_of_birth: data.baby.date_of_birth instanceof Date
            ? data.baby.date_of_birth.toISOString()
            : data.baby.date_of_birth,
        },
      };

      const response = await fetch('/api/v1/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.message || 'Registration failed');
      }

      setResearchId(result.research_id);
      setPatientId(result.id);
      setShowSuccessModal(true);
      setToast({
        type: 'success',
        message: `Registration complete! Research ID: ${result.research_id}`,
      });

    } catch (error) {
      setToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Registration failed',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = async () => {
    const stepFields = getFieldsForStep(currentStep);
    const isValid = await trigger(stepFields as any);
    if (isValid) {
      setCurrentStep(Math.min(currentStep + 1, visibleSteps.length - 1));
    }
  };

  const handlePrevious = () => {
    setCurrentStep(Math.max(currentStep - 1, 0));
  };

  return (
    <>
      {/* Toast notifications */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 max-w-md w-full">
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Progress indicator */}
        <div className="flex items-center justify-between">
          {visibleSteps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  index <= currentStep
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {index + 1}
              </div>
              <span
                className={`ml-2 text-sm hidden sm:inline ${
                  index <= currentStep ? 'text-gray-900 font-medium' : 'text-gray-400'
                }`}
              >
                {step.label}
              </span>
              {index < visibleSteps.length - 1 && (
                <div
                  className={`w-8 sm:w-12 h-0.5 mx-2 sm:mx-4 ${
                    index < currentStep ? 'bg-teal-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Current step content */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
          {visibleSteps[currentStep].component({
            register,
            watch,
            setValue,
            errors,
            isSubmitting,
          })}
        </div>

        {/* Navigation buttons */}
        <div className="flex justify-between pt-4 border-t border-gray-200">
          <Button
            type="button"
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 0 || isSubmitting}
          >
            Previous
          </Button>

          {currentStep === visibleSteps.length - 1 ? (
            <Button
              type="submit"
              variant="primary"
              loading={isSubmitting}
            //   disabled={!isValid || isSubmitting}
            >
              Register Child
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              onClick={handleNext}
              disabled={isSubmitting}
            >
              Next
            </Button>
          )}
        </div>
      </form>

      {/* Success Modal */}
      <Modal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="Registration Complete!"
        size="lg"
      >
        <div className="text-center py-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          <p className="text-gray-600 mb-2">Research ID:</p>
          <p className="text-2xl font-bold text-teal-700 mb-4 font-mono">
            {researchId}
          </p>

          <p className="text-sm text-gray-500 mb-6">
            The patient has been successfully registered. You can now add screening results
            or return to the dashboard.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={() => router.push(`/children/${patientId}/screenings/new`)}
              variant="primary"
            >
              Add Screening Result
            </Button>
            <Button
              onClick={() => router.push('/dashboard')}
              variant="outline"
            >
              Go to Dashboard
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}