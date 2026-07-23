'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, FormProvider, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Checkbox from '@/components/ui/Checkbox';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import { PatientCreateSchema, type PatientCreateInput } from '@/lib/validation/schemas';
import { ChevronLeft, ChevronRight, Send, RotateCcw, AlertTriangle, CheckCircle } from 'lucide-react';

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------
const STEPS = [
  { key: 'baby', label: 'Baby Information', icon: 'newborn' },
  { key: 'mother', label: 'Mother / Guardian', icon: 'user' },
  { key: 'consent', label: 'Consent', icon: 'shield-check' },
  { key: 'risk', label: 'Risk Factors', icon: 'alert-triangle' },
  { key: 'survey', label: 'Parent Survey', icon: 'clipboard-check' },
];

// Fields per step — mapped to PatientCreateSchema keys
const FIELDS_PER_STEP: Record<string, (keyof PatientCreateInput)[]> = {
  baby: [
    'child_name', 'date_of_birth', 'sex', 'birth_weight_grams', 'gestational_age_weeks',     // NEW: child_name
    'delivery_type', 'apgar_score_5min', 'hospital_number', 'nicu_admitted', 'nicu_days',
    'screened_at_birth',                                                                            // NEW: screened_at_birth
  ],
  mother: [
    'mother_name', 'mother_age', 'mother_phone', 'guardian_phone_alt',
    'whatsapp_number', 'email', 'residence_county', 'residence_subcounty', 'nearest_town',
  ],
  consent: ['consent_status', 'consent_form_version', 'witness_name'],
  risk: [
    'risk_nicu_admission', 'risk_prematurity_under_37wk', 'risk_hyperbilirubinemia_treated',
    'risk_ototoxic_drug_exposure', 'risk_craniofacial_anomaly', 'risk_family_history_hearing_loss',
    'risk_birth_asphyxia', 'risk_congenital_infection_torch', 'risk_syndrome_associated_with_hl',
    'risk_mechanical_ventilation_over_5d', 'risk_bacterial_meningitis',
    'risk_additional_notes',
  ],
  survey: [
    'survey_delivery_channel', 'survey_explanation_clarity_score', 'survey_anxiety_before_score',
    'survey_anxiety_after_score', 'survey_satisfaction_score', 'survey_would_recommend',
    'survey_understood_result', 'survey_knowledge_q1_correct', 'survey_knowledge_q2_correct',
    'survey_open_comments',
  ],
};

// Risk factor display data — label + auto-suggest conditions
const RISK_FACTORS = [
  { key: 'risk_nicu_admission', label: 'NICU admission (>5 days)', autoCondition: 'nicu_admitted', autoReason: 'NICU admission flag' },
  { key: 'risk_prematurity_under_37wk', label: 'Prematurity (< 37 weeks GA)', autoCondition: 'gestational_age_weeks', autoValue: 37, autoOperator: '<', autoReason: 'GA < 37 weeks' },
  { key: 'risk_hyperbilirubinemia_treated', label: 'Hyperbilirubinemia (treated)', autoCondition: null },
  { key: 'risk_ototoxic_drug_exposure', label: 'Ototoxic drug exposure', autoCondition: null },
  { key: 'risk_craniofacial_anomaly', label: 'Craniofacial anomaly', autoCondition: null },
  { key: 'risk_family_history_hearing_loss', label: 'Family history of hearing loss', autoCondition: null },
  { key: 'risk_birth_asphyxia', label: 'Birth asphyxia (Apgar ≤ 5 min)', autoCondition: 'apgar_score_5min', autoValue: 6, autoOperator: '<=', autoReason: 'Apgar ≤ 6' },
  { key: 'risk_congenital_infection_torch', label: 'Congenital infection (TORCH)', autoCondition: null },
  { key: 'risk_syndrome_associated_with_hl', label: 'Syndrome associated with HL', autoCondition: null },
  { key: 'risk_mechanical_ventilation_over_5d', label: 'Mechanical ventilation (>5 days)', autoCondition: null },
  { key: 'risk_bacterial_meningitis', label: 'Bacterial meningitis', autoCondition: null },
];

// Survey score questions (only shown when IN_PERSON)
const SURVEY_SCORE_FIELDS: { key: keyof PatientCreateInput; label: string; low: string; high: string }[] = [
  { key: 'survey_explanation_clarity_score', label: 'How clear was the explanation?', low: 'Not clear', high: 'Very clear' },
  { key: 'survey_anxiety_before_score', label: 'Anxiety before screening', low: 'Low', high: 'High' },
  { key: 'survey_anxiety_after_score', label: 'Anxiety after receiving result', low: 'Low', high: 'High' },
  { key: 'survey_satisfaction_score', label: 'Overall satisfaction', low: 'Unsatisfied', high: 'Very satisfied' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function RegisterChildPage() {
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ research_id: string; id: string } | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<PatientCreateInput>({
    resolver: zodResolver(PatientCreateSchema),
    defaultValues: {
      child_name: '',                       // NEW
      date_of_birth: '',
      sex: undefined,
      birth_weight_grams: undefined,
      gestational_age_weeks: undefined,
      delivery_type: undefined,
      apgar_score_5min: undefined,
      hospital_number: '',
      nicu_admitted: false,
      nicu_days: undefined,
      screened_at_birth: undefined,         // NEW
      entry_source: 'LIVE',
      mother_name: '',
      mother_age: undefined,
      mother_phone: '',
      guardian_phone_alt: '',
      whatsapp_number: '',
      email: '',
      residence_county: '',
      residence_subcounty: '',
      nearest_town: '',
      consent_status: undefined,
      consent_form_version: '',
      witness_name: '',
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
      risk_additional_notes: '',
      survey_delivery_channel: undefined,
      survey_explanation_clarity_score: undefined,
      survey_anxiety_before_score: undefined,
      survey_anxiety_after_score: undefined,
      survey_satisfaction_score: undefined,
      survey_would_recommend: undefined,
      survey_understood_result: undefined,
      survey_knowledge_q1_correct: undefined,
      survey_knowledge_q2_correct: undefined,
      survey_open_comments: '',
    },
    mode: 'onChange',
  });

  const {
    register,
    handleSubmit,
    trigger,
    watch,
    setValue,
    getValues,
    control,
    formState: { errors },
    reset,
  } = form;

  // Watch values for auto-suggest badges
  const watched = {
    nicu_admitted: watch('nicu_admitted'),
    nicu_days: watch('nicu_days'),
    gestational_age_weeks: watch('gestational_age_weeks'),
    apgar_score_5min: watch('apgar_score_5min'),
    consent_status: watch('consent_status'),
    survey_delivery_channel: watch('survey_delivery_channel'),
  };

  // ── Sticky nav / scroll-spy: which section is under the sticky bar right now ──
  const [activeKey, setActiveKey] = useState<string>(STEPS[0].key);
  const sectionRefs = useRef<Partial<Record<string, HTMLElement>>>({});

  const registerSectionRef = useCallback(
    (key: string) => (el: HTMLElement | null) => {
      if (el) sectionRefs.current[key] = el;
    },
    []
  );

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        const topmost = visible.reduce((a, b) =>
          a.boundingClientRect.top < b.boundingClientRect.top ? a : b
        );
        const key = topmost.target.getAttribute('data-step-key');
        if (key) setActiveKey(key);
      },
      { rootMargin: '-112px 0px -65% 0px', threshold: [0, 0.1, 0.25] }
    );
    STEPS.forEach((step) => {
      const el = sectionRefs.current[step.key];
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const scrollToSection = (key: string) => {
    sectionRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ── Which sections currently have a validation error, so the sticky nav can flag them ──
  const erroredStepKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const fieldName of Object.keys(errors)) {
      for (const [stepKey, fields] of Object.entries(FIELDS_PER_STEP)) {
        if ((fields as string[]).includes(fieldName)) keys.add(stepKey);
      }
    }
    return keys;
  }, [errors]);

  // ── Auto-suggest logic (visual only — server also computes these) ──
  function isAutoSuggested(rf: typeof RISK_FACTORS[0]): boolean {
    if (rf.autoCondition === null) return false;
    const val = watched[rf.autoCondition as keyof typeof watched];
    if (val === undefined || val === null) return false;
    if (rf.autoOperator === '<') return Number(val) < rf.autoValue!;
    if (rf.autoOperator === '<=') return Number(val) <= rf.autoValue!;
    if (rf.autoOperator === '>') return Number(val) > rf.autoValue!;
    return Boolean(val);
  }

  const showNICUNotice = watched.nicu_admitted && watched.nicu_days !== undefined && Number(watched.nicu_days) > 5;

  // ── Step navigation ──
  const advanceStep = useCallback(async () => {
    const stepKey = STEPS[currentStep].key;
    const fieldsToValidate = FIELDS_PER_STEP[stepKey];
    const valid = await trigger(fieldsToValidate);
    if (!valid) return;
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    }
  }, [currentStep, trigger]);

  const goBack = () => setCurrentStep((s) => Math.max(0, s - 1));
  const goToStep = (i: number) => setCurrentStep(i);

  // ── Skip step D/E if consent is REFUSED ──
  const effectiveSteps = (() => {
    const steps = [...STEPS];
    if (watched.consent_status === 'REFUSED') {
      return steps.filter((s) => s.key !== 'risk' && s.key !== 'survey');
    }
    return steps;
  })();

  const effectiveCurrentStep = effectiveSteps.findIndex((s) => s.key === STEPS[currentStep]?.key);

  // ── Submit ──
  const onSubmit = handleSubmit(async (data: PatientCreateInput) => {
    setSubmitting(true);
    setServerError(null);

    try {
      const res = await fetch('/api/v1/patients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify(data),
      });

      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Unknown error' }));
        setServerError(body.error || `Request failed (${res.status})`);
        setSubmitting(false);
        return;
      }

      const body = await res.json();
      setResult(body);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSubmitting(false);
    }
  }, (validationErrors) => {
    // Data entry errors can be anywhere in the five sections. Rather than
    // relying on the clerk to scroll up and hunt for them, jump straight to
    // the first invalid field and mark its section in the sticky nav (see
    // erroredStepKeys) so the error is visible without scrolling to the top.
    const firstField = Object.keys(validationErrors)[0];
    if (!firstField) return;

    const ownerStep = Object.entries(FIELDS_PER_STEP).find(([, fields]) =>
      (fields as string[]).includes(firstField)
    )?.[0];
    if (ownerStep) {
      const ownerIndex = STEPS.findIndex((s) => s.key === ownerStep);
      if (ownerIndex !== -1) setCurrentStep(ownerIndex);
    }

    requestAnimationFrame(() => {
      const el = document.getElementById(firstField);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        (el as HTMLElement).focus?.();
      } else if (ownerStep) {
        scrollToSection(ownerStep);
      }
    });
  });

  // ── Reset ──
  const handleReset = () => {
    reset();
    setResult(null);
    setServerError(null);
    setCurrentStep(0);
  };

  // ── Success state ──
  if (result) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={32} className="text-emerald-600 dark:text-emerald-400" />
        </div>
        <h2 className="text-xl font-display font-bold text-gray-900 dark:text-fg mb-2">Registration Complete</h2>
        <p className="text-sm text-gray-500 dark:text-fg-muted mb-6">The child has been registered and all records created.</p>
        <div className="bg-gray-50 dark:bg-surface-card rounded-xl border border-gray-200 dark:border-surface-border p-5 inline-block text-left mb-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-semibold text-gray-500 dark:text-fg-muted uppercase tracking-wider">Research ID</span>
          </div>
          <p className="text-2xl font-mono font-bold text-teal-700 dark:text-accent-light">{result.research_id}</p>
        </div>
        <div className="flex flex-col-reverse sm:flex-row items-center justify-center gap-3">
          <Button variant="ghost" onClick={handleReset}>
            <RotateCcw size={16} /> Register Another
          </Button>
          <Button variant="primary" onClick={() => router.push(`/children/search?q=${result.research_id}`)}>
            <Send size={16} /> View Record
          </Button>
        </div>
      </div>
    );
  }

  // ── Form ──
  return (
    <FormProvider {...form}>
      <div>
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-display font-bold text-gray-900 dark:text-fg">Register New Child</h1>
          <p className="text-sm text-gray-500 dark:text-fg-muted mt-1">
            Sections A–E · Single transaction creates all 4 records
          </p>
        </div>

        {/* Progress bar — sticky under the app TopBar; the filled portion and the
            highlighted number both track activeKey (the section currently under
            the sticky bar as you scroll), not just the Next/Back step state. */}
        <div
          className="sticky top-0 z-20 flex items-center gap-2 py-3 mb-8
            bg-gray-50/95 dark:bg-surface/95 backdrop-blur-sm
            border-b border-gray-200 dark:border-surface-border"
        >
          {effectiveSteps.map((step, i) => {
            const activeIndex = effectiveSteps.findIndex((s) => s.key === activeKey);
            const isActive = step.key === activeKey;
            const isFilled = i <= (activeIndex === -1 ? effectiveCurrentStep : activeIndex);
            const hasError = erroredStepKeys.has(step.key);
            return (
              <button
                key={step.key}
                type="button"
                onClick={() => scrollToSection(step.key)}
                className="flex items-center gap-2 flex-1 group"
                aria-label={`Jump to ${step.label}`}
                aria-current={isActive ? 'step' : undefined}
              >
                <span className={`h-2 rounded-full flex-1 transition-colors ${isFilled ? 'bg-accent' : 'bg-gray-200 dark:bg-surface-border'}`} />
                <span className="relative w-6 text-right shrink-0">
                  <span className={`text-xs font-medium ${isActive ? 'text-accent' : 'text-gray-400 dark:text-fg-muted group-hover:text-gray-600 dark:group-hover:text-fg'}`}>
                    {i + 1}
                  </span>
                  {hasError && (
                    <span
                      className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 dark:bg-red-400"
                      aria-label={`${step.label} has an error`}
                    />
                  )}
                </span>
                {i < effectiveSteps.length - 1 && (
                  <ChevronRight size={14} className="text-gray-300 dark:text-surface-border shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* NICU AABR notice */}
        {showNICUNotice && effectiveCurrentStep >= 0 && (
          <Alert variant="warning" dismissible>
            <div>
              <strong>AABR Required.</strong> NICU stay &gt;5 days detected — JCIH 2019 mandates
              Automated Auditory Brainstem Response (AABR) rather than OAE alone for these babies
              (risk of auditory neuropathy spectrum disorder). The screening modality will be set by
              the screener at test time, not here — but the pathway engine enforces it.
            </div>
          </Alert>
        )}

        {/* Survey timing notice */}
        {effectiveSteps[effectiveCurrentStep]?.key === 'survey' && watched.survey_delivery_channel === 'IN_PERSON' && (
          <Alert variant="info" dismissible>
            <div>
              <strong>Pre-screening survey scores noted.</strong> Some questions (anxiety after result,
              satisfaction, understood result, knowledge) presuppose a completed screening. The
              clerk should capture what they can now; the remaining fields will be available for update
              after the screening event is logged.
            </div>
          </Alert>
        )}

        {/* Server error */}
        {serverError && (
          <Alert variant="warning" dismissible>
            <strong>Submission failed.</strong> {serverError}
          </Alert>
        )}

        {/* Form */}
        <form onSubmit={onSubmit} noValidate className="space-y-6">
          {/* ── Step A: Baby Information ── */}
          <section
            id="section-baby"
            ref={registerSectionRef('baby')}
            data-step-key="baby"
            className="card-theme scroll-mt-24"
          >
            <h2 className="text-base font-display font-semibold text-gray-900 dark:text-fg mb-5 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-accent/10 flex items-center justify-center">
                <span className="text-teal-700 dark:text-accent-light text-sm font-bold">A</span>
              </span>
              Baby Information
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

              {/* ── NEW: Child's Name — first field, most prominent ── */}
              <div className="sm:col-span-2 lg:col-span-2">
                <Input
                  id="child_name"
                  label="Child's Name"
                  placeholder="e.g. John Kamau"
                  hint="Optional — can be added later if not yet named"
                />
              </div>

              <Input
                id="date_of_birth"
                label="Date of Birth"
                type="datetime-local"
                required
              />
              <Select
                id="sex"
                label="Sex"
                required
                options={[
                  { value: 'Male', label: 'Male' },
                  { value: 'Female', label: 'Female' },
                ]}
                placeholder="Select sex"
              />
              <Input
                id="birth_weight_grams"
                label="Birth Weight (grams)"
                type="number"
                required
                placeholder="e.g. 3200"
              />
              <Input
                id="gestational_age_weeks"
                label="Gestational Age (weeks)"
                type="number"
                required
                placeholder="e.g. 39"
                hint="Drives prematurity auto-flag if < 37"
              />
              <Select
                id="delivery_type"
                label="Delivery Type"
                required
                options={[
                  { value: 'NVD', label: 'Normal Vaginal Delivery (NVD)' },
                  { value: 'C_Section', label: 'Caesarean Section' },
                  { value: 'Assisted_Vacuum_Forceps', label: 'Assisted (Vacuum/Forceps)' },
                ]}
                placeholder="Select type"
              />
              <Input
                id="apgar_score_5min"
                label="Apgar Score (5 min)"
                type="number"
                hint="Drives birth-asphyxia auto-flag if ≤ 6"
              />
              <Input
                id="hospital_number"
                label="Hospital Number"
                placeholder="Optional"
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-fg">
                  NICU Admitted <span className="text-red-500 dark:text-red-400 ml-0.5">*</span>
                </label>
                <Controller
                  control={control}
                  name="nicu_admitted"
                  render={({ field }) => (
                    <div className="flex gap-3 mt-1.5">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={field.value === true}
                          onChange={() => field.onChange(true)}
                          onBlur={field.onBlur}
                          className="w-4 h-4 text-accent-600 dark:text-accent-light accent-teal-600 dark:accent-teal-500 focus:ring-accent/30"
                        />
                        <span className="text-sm text-gray-700 dark:text-fg">Yes</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={field.value === false}
                          onChange={() => field.onChange(false)}
                          onBlur={field.onBlur}
                          className="w-4 h-4 text-gray-400 border-gray-300 dark:border-surface-border focus:ring-accent/30"
                        />
                        <span className="text-sm text-gray-600 dark:text-fg-muted">No</span>
                      </label>
                    </div>
                  )}
                />
              </div>
              <Input
                id="nicu_days"
                label="NICU Days"
                type="number"
                placeholder="Only if NICU admitted"
              />

              {/* ── NEW: Screened at Birth — Yes / No / Unknown ── */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-fg">
                  Screened at Birth?
                </label>
                <Controller
                  control={control}
                  name="screened_at_birth"
                  render={({ field }) => (
                    <div className="flex gap-3 mt-1.5">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={field.value === true}
                          onChange={() => field.onChange(true)}
                          onBlur={field.onBlur}
                          className="w-4 h-4 text-accent-600 dark:text-accent-light accent-teal-600 dark:accent-teal-500 focus:ring-accent/30"
                        />
                        <span className="text-sm text-gray-700 dark:text-fg">Yes</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={field.value === false}
                          onChange={() => field.onChange(false)}
                          onBlur={field.onBlur}
                          className="w-4 h-4 text-gray-400 border-gray-300 dark:border-surface-border focus:ring-accent/30"
                        />
                        <span className="text-sm text-gray-600 dark:text-fg-muted">No</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={field.value === null || field.value === undefined}
                          onChange={() => field.onChange(null)}
                          onBlur={field.onBlur}
                          className="w-4 h-4 text-gray-400 border-gray-300 dark:border-surface-border focus:ring-accent/30"
                        />
                        <span className="text-sm text-gray-500 dark:text-fg-muted">Unknown</span>
                      </label>
                    </div>
                  )}
                />
                <p className="text-xs text-gray-400 dark:text-fg-muted mt-1">
                  Whether the child received a hearing screening at the place of birth
                </p>
              </div>

            </div>
          </section>

          {/* ── Step B: Mother/Guardian ── */}
          <section
            id="section-mother"
            ref={registerSectionRef('mother')}
            data-step-key="mother"
            className="card-theme scroll-mt-24"
          >
            <h2 className="text-base font-display font-semibold text-gray-900 dark:text-fg mb-5 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-accent/10 flex items-center justify-center">
                <span className="text-teal-700 dark:text-accent-light text-sm font-bold">B</span>
              </span>
              Mother / Guardian Information
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Input id="mother_name" label="Mother's Full Name" required placeholder="e.g. Mary Wanjiku" />
              <Input id="mother_age" label="Mother's Age" type="number" required placeholder="e.g. 28" />
              <Input id="mother_phone" label="Mother's Phone" required placeholder="+2547XXXXXXXX" />
              <Input id="guardian_phone_alt" label="Guardian Alt. Phone" placeholder="Optional" />
              <Input id="whatsapp_number" label="WhatsApp Number" placeholder="Optional" />
              <Input id="email" label="Email" type="email" placeholder="Optional" />
              <Input id="residence_county" label="County" required placeholder="e.g. Uasin Gishu" />
              <Input id="residence_subcounty" label="Sub-County" required placeholder="e.g. Kapseret" />
              <Input id="nearest_town" label="Nearest Town" required placeholder="e.g. Eldoret" />
            </div>
          </section>

          {/* ── Step C: Consent ── */}
          <section
            id="section-consent"
            ref={registerSectionRef('consent')}
            data-step-key="consent"
            className="card-theme scroll-mt-24"
          >
            <h2 className="text-base font-display font-semibold text-gray-900 dark:text-fg mb-5 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-accent/10 flex items-center justify-center">
                <span className="text-teal-700 dark:text-accent-light text-sm font-bold">C</span>
              </span>
              Consent
            </h2>

            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-fg mb-2">
                    Consent Status <span className="text-red-500 dark:text-red-400 ml-0.5">*</span>
                  </label>
                  <div className="space-y-2">
                    {(['GIVEN', 'REFUSED', 'PENDING'] as const).map((status) => (
                      <label key={status} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          {...register('consent_status')}
                          value={status}
                          className="w-4 h-4 text-accent-600 dark:text-accent-light accent-teal-600 dark:accent-teal-500 focus:ring-accent/30"
                        />
                        <span className="text-sm text-gray-700 dark:text-fg">{status.replace('_', ' ')}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <Input id="consent_form_version" label="Form Version" required placeholder="e.g. v2.1-IREC-approved" />
                <Input id="witness_name" label="Witness Name" placeholder="Optional" />
              </div>

              {/* Consent REFUSED notice */}
              {watched.consent_status === 'REFUSED' && (
                <Alert variant="warning" dismissible>
                  <div>
                    <strong>Consent refused.</strong> Risk factors and survey sections are hidden.
                    The patient record will still be created (for STROBE flow diagram accounting) but
                    no research data from this child will appear in exports.
                  </div>
                </Alert>
              )}

              {/* Consent PENDING notice */}
              {watched.consent_status === 'PENDING' && (
                <Alert variant="info" dismissible>
                  <div>
                    <strong>Consent pending.</strong> The child can still be screened, but no research data
                    from this child will appear in exports until consent is updated to GIVEN.
                  </div>
                </Alert>
              )}
            </div>
          </section>

          {/* ── Step D: Risk Factors ── */}
          <section
            id="section-risk"
            ref={registerSectionRef('risk')}
            data-step-key="risk"
            className="card-theme scroll-mt-24"
          >
            <h2 className="text-base font-display font-semibold text-gray-900 dark:text-fg mb-2 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                <span className="text-amber-700 dark:text-amber-400 text-sm font-bold">D</span>
              </span>
              JCIH 2019 Risk Factor Checklist
            </h2>
            <p className="text-xs text-gray-500 dark:text-fg-muted mb-5">
              Check all that apply. Auto-suggested items are pre-filled based on submitted baby data (bold = auto-suggested).
              Each flag becomes an independent predictor variable in the regression analysis.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {RISK_FACTORS.map((rf) => {
                const auto = isAutoSuggested(rf);
                return (
                  <Checkbox
                    key={rf.key}
                    id={rf.key}
                    label={rf.label}
                    autoSuggested={auto}
                    autoSuggestedReason={rf.autoReason ?? ''}
                  />
                );
              })}
            </div>

            <div className="mt-5">
              <label className="block text-sm font-medium text-gray-700 dark:text-fg mb-1.5">
                Additional Notes
              </label>
              <textarea
                id="risk_additional_notes"
                placeholder="Optional — free text, NOT used as a coded research variable"
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-lg text-sm border bg-white dark:bg-surface-card
                  text-gray-900 dark:text-fg placeholder-gray-400 dark:placeholder-fg-muted
                  border-gray-300 dark:border-surface-border
                  focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                {...register('risk_additional_notes')}
              />
            </div>
          </section>

          {/* ── Step E: Survey ── */}
          <section
            id="section-survey"
            ref={registerSectionRef('survey')}
            data-step-key="survey"
            className="card-theme scroll-mt-24"
          >
            <h2 className="text-base font-display font-semibold text-gray-900 dark:text-fg mb-2 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-accent/10 flex items-center justify-center">
                <span className="text-teal-700 dark:text-accent-light text-sm font-bold">E</span>
              </span>
              Parent Survey Preferences
            </h2>
            <p className="text-xs text-gray-500 dark:text-fg-muted mb-5">
              How would the parent prefer to answer the satisfaction survey?
            </p>

            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Select
                  id="survey_delivery_channel"
                  label="Survey Delivery Channel"
                  required
                  options={[
                    { value: 'IN_PERSON', label: 'In Person (clerk administers now)' },
                    { value: 'SMS', label: 'SMS (sent after discharge)' },
                    { value: 'WHATSAPP', label: 'WhatsApp (sent after discharge)' },
                  ]}
                  placeholder="Select channel"
                />
              </div>

              {/* IN_PERSON score fields */}
              {watched.survey_delivery_channel === 'IN_PERSON' && (
                <div className="space-y-4">
                  <p className="text-xs font-medium text-gray-500 dark:text-fg-muted">
                    Scores collected now (post-screening fields noted — see §5 gap documentation)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {SURVEY_SCORE_FIELDS.map((sf) => (
                      <div key={sf.key} className="space-y-1.5">
                        <label className="block text-xs font-medium text-gray-600 dark:text-fg-muted">
                          {sf.label}
                        </label>
                        <div className="flex items-center gap-2">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setValue(sf.key, n as 1 | 2 | 3 | 4 | 5)}
                              className={`w-9 h-9 rounded-lg text-xs font-bold transition-all duration-150 border ${
                                getValues(sf.key) === n
                                  ? 'bg-accent text-white border-accent shadow-sm'
                                  : 'bg-white dark:bg-surface-card border-gray-200 dark:border-surface-border hover:border-gray-300 dark:hover:border-surface-hover'
                              }`}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40">
                    <AlertTriangle size={16} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-800 dark:text-blue-300">
                      <strong>Pre-screening survey.</strong> Some questions (anxiety after, satisfaction,
                      understood result, knowledge) presuppose a completed screening. Capture what you can now;
                      the remaining fields will be available for update after the screening event is logged.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        {...register('survey_would_recommend')}
                        className="w-4 h-4 rounded border-gray-300 dark:border-surface-border text-accent-600 dark:text-accent-light
                                   accent-teal-600 dark:accent-teal-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-fg">Would recommend programme to another parent</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        {...register('survey_understood_result')}
                        className="w-4 h-4 rounded border-gray-300 dark:border-surface-border text-accent-600 dark:text-accent-light
                                   accent-teal-600 dark:accent-teal-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-fg">Parent understood the screening result</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        {...register('survey_knowledge_q1_correct')}
                        className="w-4 h-4 rounded border-gray-300 dark:border-surface-border text-accent-600 dark:text-accent-light
                                   accent-teal-600 dark:accent-teal-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-fg">Knowledge question 1 correct</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        {...register('survey_knowledge_q2_correct')}
                        className="w-4 h-4 rounded border-gray-300 dark:border-surface-border text-accent-600 dark:text-accent-light
                                   accent-teal-600 dark:accent-teal-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-fg">Knowledge question 2 correct</span>
                    </label>
                    <textarea
                      id="survey_open_comments"
                      placeholder="Optional open comments from parent"
                      rows={3}
                      className="w-full px-3.5 py-2.5 rounded-lg text-sm border bg-white dark:bg-surface-card
                        text-gray-900 dark:text-fg placeholder-gray-400 dark:placeholder-fg-muted
                        border-gray-300 dark:border-surface-border
                        focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                      {...register('survey_open_comments')}
                    />
                  </div>
                </div>
              )}

              {/* SMS / WHATSAPP notice */}
              {watched.survey_delivery_channel && watched.survey_delivery_channel !== 'IN_PERSON' && (
                <Alert variant="info" dismissible>
                  <div>
                    <strong>Remote survey scheduled.</strong> A survey will be sent after discharge via{' '}
                    <strong>{watched.survey_delivery_channel}</strong>. A single reminder will be sent
                    if no response is received. <strong>No further attempts</strong> — repeated messaging
                    would consume the same channel used for clinical reminders (§4.10.1).
                  </div>
                </Alert>
              )}
            </div>
          </section>

          {/* Navigation */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-6 border-t border-gray-200 dark:border-surface-border">
            <Button
              type="button"
              variant="ghost"
              onClick={goBack}
              disabled={effectiveCurrentStep === 0}
            >
              <ChevronLeft size={16} />
              Back
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              {effectiveCurrentStep < effectiveSteps.length - 1 && (
                <Button type="button" variant="ghost" onClick={advanceStep}>
                  Next Step
                  <ChevronRight size={16} />
                </Button>
              )}
              {/* The one true submit for this form — every other button here is
                  type="button" so nothing else can accidentally persist data. */}
              <Button type="submit" variant="primary" loading={submitting}>
                <Send size={16} />
                {submitting ? 'Submitting...' : 'Register Child'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </FormProvider>
  );
}