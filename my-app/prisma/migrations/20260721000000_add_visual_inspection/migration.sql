-- CreateEnum
CREATE TYPE "VisualInspectionOutcome" AS ENUM ('PASS', 'MINOR_ANOMALY', 'PE_TUBE', 'REFER_MEDICAL');

-- CreateTable
CREATE TABLE "visual_inspections" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "ear" "Ear" NOT NULL,
    "outcome" "VisualInspectionOutcome" NOT NULL,
    "finding_note" TEXT,
    "screener_id" UUID NOT NULL,
    "inspected_at" TIMESTAMP(3) NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL,
    "entrySource" "EntrySource" NOT NULL DEFAULT 'LIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" UUID NOT NULL,

    CONSTRAINT "visual_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "visual_inspections_patient_id_ear_idx" ON "visual_inspections"("patient_id", "ear");

-- AddForeignKey
ALTER TABLE "visual_inspections" ADD CONSTRAINT "visual_inspections_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visual_inspections" ADD CONSTRAINT "visual_inspections_screener_id_fkey" FOREIGN KEY ("screener_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visual_inspections" ADD CONSTRAINT "visual_inspections_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
