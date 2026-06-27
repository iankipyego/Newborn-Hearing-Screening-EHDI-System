-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('Male', 'Female');

-- CreateEnum
CREATE TYPE "DeliveryType" AS ENUM ('NVD', 'C_Section', 'Assisted_Vacuum_Forceps');

-- CreateEnum
CREATE TYPE "EntrySource" AS ENUM ('LIVE', 'PAPER_BACKUP');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('GIVEN', 'REFUSED', 'PENDING');

-- CreateEnum
CREATE TYPE "Ear" AS ENUM ('LEFT', 'RIGHT');

-- CreateEnum
CREATE TYPE "ScreeningStage" AS ENUM ('SCREEN_1', 'SCREEN_2', 'RESCREEN_POST_REFERRAL');

-- CreateEnum
CREATE TYPE "ScreeningModality" AS ENUM ('OAE', 'AABR');

-- CreateEnum
CREATE TYPE "ProbeFitQuality" AS ENUM ('Good', 'Fair', 'Poor');

-- CreateEnum
CREATE TYPE "AmbientNoiseLevel" AS ENUM ('Low', 'Medium', 'High');

-- CreateEnum
CREATE TYPE "ScreeningResult" AS ENUM ('PASS', 'NOT_PASS', 'INCOMPLETE');

-- CreateEnum
CREATE TYPE "ReferralType" AS ENUM ('HEALTH_CARE_PROVIDER', 'AUDIOLOGIST');

-- CreateEnum
CREATE TYPE "DiagnosisAtReferral" AS ENUM ('Otitis_media', 'Blockage', 'Infection', 'Clear', 'Other');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'CLEARED', 'TREATED', 'NO_SHOW', 'SEEN');

-- CreateEnum
CREATE TYPE "EvaluationType" AS ENUM ('ABR', 'VRA', 'CPA', 'OAE');

-- CreateEnum
CREATE TYPE "DiagnosticDiagnosis" AS ENUM ('Normal', 'Conductive_loss', 'Sensorineural_loss', 'Mixed_loss', 'Auditory_neuropathy');

-- CreateEnum
CREATE TYPE "HearingLossDegree" AS ENUM ('Mild', 'Moderate', 'Severe', 'Profound');

-- CreateEnum
CREATE TYPE "Laterality" AS ENUM ('Unilateral', 'Bilateral');

-- CreateEnum
CREATE TYPE "PathwayFinalStatus" AS ENUM ('PASSED', 'IN_PROGRESS', 'REFERRED_AUDIOLOGY', 'DIAGNOSED', 'LOST_TO_FOLLOWUP');

-- CreateEnum
CREATE TYPE "NotificationTriggerReason" AS ENUM ('REFERRAL_SCHEDULED', 'RESCREEN_SCHEDULED', 'FOLLOW_UP_REMINDER', 'AUDIOLOGY_REFERRAL', 'LOST_TO_FOLLOWUP_WARNING');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('SMS', 'WHATSAPP', 'EMAIL');

-- CreateEnum
CREATE TYPE "NotificationLanguage" AS ENUM ('en', 'sw');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "SurveyDeliveryChannelPreference" AS ENUM ('IN_PERSON', 'SMS', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "SurveyStatus" AS ENUM ('PENDING', 'COMPLETED', 'NO_RESPONSE');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('INSERT', 'UPDATE');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('DATA_CLERK', 'SCREENER', 'SUPERVISOR', 'RESEARCHER', 'ADMIN');

-- CreateEnum
CREATE TYPE "CorrectionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "QiReviewStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'CLOSED');

-- CreateEnum
CREATE TYPE "AudiogramTestType" AS ENUM ('AC', 'BC');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "site_id" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "totp_secret" TEXT,
    "totp_enabled" BOOLEAN NOT NULL DEFAULT false,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "password_reset_token" TEXT,
    "password_reset_expires" TIMESTAMP(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivated_at" TIMESTAMP(3),
    "deactivated_by_id" UUID,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sites" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "county" TEXT NOT NULL,
    "subcounty" TEXT,
    "contact_person" TEXT NOT NULL,
    "contact_phone" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" UUID NOT NULL,
    "research_id" TEXT NOT NULL,
    "hospital_number" TEXT,
    "date_of_birth" TIMESTAMP(3) NOT NULL,
    "sex" "Sex" NOT NULL,
    "birth_weight_grams" INTEGER NOT NULL,
    "gestational_age_weeks" DECIMAL(4,2) NOT NULL,
    "delivery_type" "DeliveryType" NOT NULL,
    "apgar_score_5min" INTEGER,
    "mother_name" TEXT NOT NULL,
    "mother_age" INTEGER NOT NULL,
    "mother_phone" TEXT NOT NULL,
    "guardian_phone_alt" TEXT,
    "whatsapp_number" TEXT,
    "email" TEXT,
    "residence_county" TEXT NOT NULL,
    "residence_subcounty" TEXT NOT NULL,
    "nearest_town" TEXT NOT NULL,
    "nicu_admitted" BOOLEAN NOT NULL,
    "nicu_days" INTEGER,
    "entry_source" "EntrySource" NOT NULL,
    "site_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_records" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "status" "ConsentStatus" NOT NULL,
    "consent_form_version" TEXT NOT NULL,
    "consented_at" TIMESTAMP(3) NOT NULL,
    "consented_by_clerk_id" UUID NOT NULL,
    "witness_name" TEXT,
    "withdrawn_at" TIMESTAMP(3),
    "withdrawn_by_clerk_id" UUID,
    "withdrawal_reason" TEXT,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_factors" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "nicu_admission" BOOLEAN NOT NULL,
    "prematurity_under_37wk" BOOLEAN NOT NULL,
    "hyperbilirubinemia_treated" BOOLEAN NOT NULL,
    "ototoxic_drug_exposure" BOOLEAN NOT NULL,
    "craniofacial_anomaly" BOOLEAN NOT NULL,
    "family_history_hearing_loss" BOOLEAN NOT NULL,
    "birth_asphyxia" BOOLEAN NOT NULL,
    "congenital_infection_torch" BOOLEAN NOT NULL,
    "syndrome_associated_with_hl" BOOLEAN NOT NULL,
    "mechanical_ventilation_over_5d" BOOLEAN NOT NULL,
    "bacterial_meningitis" BOOLEAN NOT NULL,
    "additional_notes" TEXT,
    "risk_factor_count" INTEGER NOT NULL,

    CONSTRAINT "risk_factors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "screening_events" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "ear" "Ear" NOT NULL,
    "stage" "ScreeningStage" NOT NULL,
    "modality" "ScreeningModality" NOT NULL,
    "equipment_id" TEXT NOT NULL,
    "probe_fit_quality" "ProbeFitQuality",
    "ambient_noise_level" "AmbientNoiseLevel" NOT NULL,
    "attempts" INTEGER NOT NULL,
    "screener_id" UUID NOT NULL,
    "duration_minutes" DECIMAL(6,2) NOT NULL,
    "result" "ScreeningResult" NOT NULL,
    "incomplete_reason" TEXT,
    "tested_at" TIMESTAMP(3) NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "screening_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "ear" "Ear" NOT NULL,
    "type" "ReferralType" NOT NULL,
    "reason" TEXT NOT NULL,
    "referred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "provider_name" TEXT NOT NULL,
    "facility" TEXT NOT NULL,
    "diagnosis_at_referral" "DiagnosisAtReferral",
    "treatment_given" TEXT,
    "medical_clearance_given" BOOLEAN,
    "pe_tube_placed" BOOLEAN,
    "resolved_at" TIMESTAMP(3),
    "status" "ReferralStatus" NOT NULL,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_evaluations" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "ear" "Ear" NOT NULL,
    "audiologist_name" TEXT NOT NULL,
    "facility" TEXT NOT NULL,
    "evaluation_type" "EvaluationType" NOT NULL,
    "evaluated_at" TIMESTAMP(3) NOT NULL,
    "diagnosis" "DiagnosticDiagnosis" NOT NULL,
    "degree" "HearingLossDegree",
    "laterality" "Laterality" NOT NULL,
    "hearing_aid_recommended" BOOLEAN NOT NULL,
    "hearing_aid_fitted_date" DATE,
    "cochlear_implant_referral" BOOLEAN NOT NULL,
    "early_intervention_enrolled" BOOLEAN NOT NULL,
    "intervention_start_date" DATE,

    CONSTRAINT "diagnostic_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_thresholds" (
    "id" UUID NOT NULL,
    "diagnostic_evaluation_id" UUID NOT NULL,
    "frequency_hz" INTEGER NOT NULL,
    "threshold_db" INTEGER NOT NULL,
    "ear" "Ear" NOT NULL,
    "test_type" "AudiogramTestType" NOT NULL,

    CONSTRAINT "diagnostic_thresholds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pathway_milestones" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "days_birth_to_first_screen" INTEGER NOT NULL,
    "days_first_screen_to_screen2" INTEGER,
    "days_screen2_to_referral" INTEGER,
    "days_referral_to_clearance" INTEGER,
    "days_clearance_to_rescreen" INTEGER,
    "days_audiology_referral_to_eval" INTEGER,
    "days_diagnosis_to_intervention" INTEGER,
    "screened_within_1_month" BOOLEAN NOT NULL,
    "diagnosed_within_3_months" BOOLEAN NOT NULL,
    "intervention_within_6_months" BOOLEAN NOT NULL,
    "final_status" "PathwayFinalStatus" NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pathway_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications_log" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "trigger_reason" "NotificationTriggerReason" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "language" "NotificationLanguage" NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL,
    "delivery_status" "DeliveryStatus" NOT NULL,
    "provider_message_id" TEXT,
    "message_content" TEXT NOT NULL,

    CONSTRAINT "notifications_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operational_logs" (
    "id" UUID NOT NULL,
    "log_date" DATE NOT NULL,
    "site_id" UUID NOT NULL,
    "total_births" INTEGER NOT NULL,
    "total_screened" INTEGER NOT NULL,
    "total_missed" INTEGER NOT NULL,
    "missed_discharged_early" INTEGER NOT NULL DEFAULT 0,
    "missed_refused" INTEGER NOT NULL DEFAULT 0,
    "missed_equipment_down" INTEGER NOT NULL DEFAULT 0,
    "missed_staff_absent" INTEGER NOT NULL DEFAULT 0,
    "avg_screening_time_minutes" DECIMAL(6,2) NOT NULL,
    "equipment_downtime_minutes" INTEGER NOT NULL,
    "power_outage_minutes" INTEGER NOT NULL,
    "probes_replaced" INTEGER NOT NULL,
    "consumable_cost" DECIMAL(10,2) NOT NULL,
    "staff_on_duty_count" INTEGER NOT NULL,
    "recorded_by" UUID NOT NULL,

    CONSTRAINT "operational_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parent_surveys" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "delivery_channel_preference" "SurveyDeliveryChannelPreference" NOT NULL,
    "status" "SurveyStatus" NOT NULL DEFAULT 'PENDING',
    "attempts_sent" INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" TIMESTAMP(3),
    "explanation_clarity_score" INTEGER,
    "anxiety_before_score" INTEGER,
    "anxiety_after_score" INTEGER,
    "satisfaction_score" INTEGER,
    "would_recommend" BOOLEAN,
    "understood_result" BOOLEAN,
    "knowledge_q1_correct" BOOLEAN,
    "knowledge_q2_correct" BOOLEAN,
    "open_comments" TEXT,

    CONSTRAINT "parent_surveys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_snapshots" (
    "id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "coverage_rate" DECIMAL(5,4) NOT NULL,
    "screened_by_1mo_rate" DECIMAL(5,4) NOT NULL,
    "referral_rate" DECIMAL(5,4) NOT NULL,
    "return_for_rescreen_rate" DECIMAL(5,4) NOT NULL,
    "diagnosis_by_3mo_rate" DECIMAL(5,4) NOT NULL,
    "intervention_by_6mo_rate" DECIMAL(5,4) NOT NULL,
    "loss_to_followup_rate" DECIMAL(5,4) NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quality_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "table_name" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "changed_by" UUID NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "before_value" JSONB,
    "after_value" JSONB NOT NULL,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "correction_requests" (
    "id" UUID NOT NULL,
    "requested_by" UUID NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "table_name" TEXT NOT NULL,
    "record_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "proposed_value" JSONB NOT NULL,
    "status" "CorrectionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "reviewer_note" TEXT,

    CONSTRAINT "correction_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qi_review_log" (
    "id" UUID NOT NULL,
    "review_date" DATE NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issue_identified" TEXT NOT NULL,
    "root_cause" TEXT,
    "action_taken" TEXT NOT NULL,
    "responsible_person" TEXT NOT NULL,
    "follow_up_date" DATE,
    "status" "QiReviewStatus" NOT NULL,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "qi_review_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "patients_research_id_key" ON "patients"("research_id");

-- CreateIndex
CREATE UNIQUE INDEX "consent_records_patient_id_key" ON "consent_records"("patient_id");

-- CreateIndex
CREATE UNIQUE INDEX "risk_factors_patient_id_key" ON "risk_factors"("patient_id");

-- CreateIndex
CREATE UNIQUE INDEX "pathway_milestones_patient_id_key" ON "pathway_milestones"("patient_id");

-- CreateIndex
CREATE UNIQUE INDEX "operational_logs_log_date_site_id_key" ON "operational_logs"("log_date", "site_id");

-- CreateIndex
CREATE UNIQUE INDEX "parent_surveys_patient_id_key" ON "parent_surveys"("patient_id");

-- CreateIndex
CREATE UNIQUE INDEX "quality_snapshots_period_start_period_end_key" ON "quality_snapshots"("period_start", "period_end");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_deactivated_by_id_fkey" FOREIGN KEY ("deactivated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_consented_by_clerk_id_fkey" FOREIGN KEY ("consented_by_clerk_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_withdrawn_by_clerk_id_fkey" FOREIGN KEY ("withdrawn_by_clerk_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_factors" ADD CONSTRAINT "risk_factors_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screening_events" ADD CONSTRAINT "screening_events_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screening_events" ADD CONSTRAINT "screening_events_screener_id_fkey" FOREIGN KEY ("screener_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_evaluations" ADD CONSTRAINT "diagnostic_evaluations_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_thresholds" ADD CONSTRAINT "diagnostic_thresholds_diagnostic_evaluation_id_fkey" FOREIGN KEY ("diagnostic_evaluation_id") REFERENCES "diagnostic_evaluations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pathway_milestones" ADD CONSTRAINT "pathway_milestones_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications_log" ADD CONSTRAINT "notifications_log_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_logs" ADD CONSTRAINT "operational_logs_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_logs" ADD CONSTRAINT "operational_logs_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_surveys" ADD CONSTRAINT "parent_surveys_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qi_review_log" ADD CONSTRAINT "qi_review_log_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qi_review_log" ADD CONSTRAINT "qi_review_log_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
