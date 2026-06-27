
#!/bin/bash

# Create all folders and files from the project structure
# Skips if folder/file already exists

echo "Creating project structure..."

# ============================================
# APP ROUTER - AUTH GROUP (unauthenticated)
# ============================================

# Login pages
mkdir -p app/\(auth\)/login/2fa
touch app/\(auth\)/login/page.tsx
touch app/\(auth\)/login/2fa/page.tsx

# Reset password pages
mkdir -p app/\(auth\)/login/reset/\[token\]
touch app/\(auth\)/login/reset/page.tsx
touch app/\(auth\)/login/reset/\[token\]/page.tsx

# ============================================
# APP ROUTER - APP GROUP (authenticated)
# ============================================

# Main layout
touch app/\(app\)/layout.tsx

# Dashboard
mkdir -p app/\(app\)/dashboard
touch app/\(app\)/dashboard/page.tsx

# Children
mkdir -p app/\(app\)/children/new
mkdir -p app/\(app\)/children/search
mkdir -p app/\(app\)/children/\[id\]/screenings/new
mkdir -p app/\(app\)/children/\[id\]/risk-factors
mkdir -p app/\(app\)/children/\[id\]/consent
mkdir -p app/\(app\)/children/\[id\]/referrals/new
mkdir -p app/\(app\)/children/\[id\]/diagnostics/new/survey

touch app/\(app\)/children/page.tsx
touch app/\(app\)/children/new/page.tsx
touch app/\(app\)/children/search/page.tsx
touch app/\(app\)/children/\[id\]/page.tsx
touch app/\(app\)/children/\[id\]/screenings/new/page.tsx
touch app/\(app\)/children/\[id\]/risk-factors/page.tsx
touch app/\(app\)/children/\[id\]/consent/page.tsx
touch app/\(app\)/children/\[id\]/referrals/new/page.tsx
touch app/\(app\)/children/\[id\]/diagnostics/new/page.tsx
touch app/\(app\)/children/\[id\]/diagnostics/new/survey/page.tsx

# Screenings
mkdir -p app/\(app\)/screenings/\[eventId\]/edit
mkdir -p app/\(app\)/screenings/\[eventId\]/flag
touch app/\(app\)/screenings/\[eventId\]/edit/page.tsx
touch app/\(app\)/screenings/\[eventId\]/flag/page.tsx

# Referrals
mkdir -p app/\(app\)/referrals/\[referralId\]/edit
touch app/\(app\)/referrals/\[referralId\]/edit/page.tsx

# Operational Logs
mkdir -p app/\(app\)/operational-logs/new
touch app/\(app\)/operational-logs/page.tsx
touch app/\(app\)/operational-logs/new/page.tsx

# Quality
mkdir -p app/\(app\)/quality/action-needed
touch app/\(app\)/quality/page.tsx
touch app/\(app\)/quality/action-needed/page.tsx

# Exports
mkdir -p app/\(app\)/exports/\[jobId\]
touch app/\(app\)/exports/page.tsx
touch app/\(app\)/exports/\[jobId\]/page.tsx

# Corrections
touch app/\(app\)/corrections/page.tsx

# Profile
touch app/\(app\)/profile/page.tsx

# Admin - Users
mkdir -p app/\(app\)/admin/users/new
mkdir -p app/\(app\)/admin/users/\[userId\]/edit
touch app/\(app\)/admin/users/page.tsx
touch app/\(app\)/admin/users/new/page.tsx
touch app/\(app\)/admin/users/\[userId\]/edit/page.tsx

# Admin - Sites
touch app/\(app\)/admin/sites/page.tsx

# Admin - Equipment
touch app/\(app\)/admin/equipment/page.tsx

# Admin - Training
touch app/\(app\)/admin/training/page.tsx

# Admin - Paper Backup Form
mkdir -p app/\(app\)/admin/paper-backup-form/audit-log
touch app/\(app\)/admin/paper-backup-form/page.tsx
touch app/\(app\)/admin/paper-backup-form/audit-log/page.tsx

# ============================================
# API ROUTES
# ============================================

# API v1 - Catch-all routes
mkdir -p app/api/v1/auth/\[...route\]
mkdir -p app/api/v1/patients/\[...route\]
mkdir -p app/api/v1/screenings/\[...route\]
mkdir -p app/api/v1/referrals/\[...route\]
mkdir -p app/api/v1/diagnostics/\[...route\]
mkdir -p app/api/v1/notifications/\[...route\]
mkdir -p app/api/v1/operational-logs/\[...route\]
mkdir -p app/api/v1/dashboard/\[...route\]
mkdir -p app/api/v1/exports/\[...route\]
mkdir -p app/api/v1/corrections/\[...route\]
mkdir -p app/api/v1/users/\[...route\]
mkdir -p app/api/v1/sites/\[...route\]

touch app/api/v1/auth/\[...route\]/route.ts
touch app/api/v1/patients/\[...route\]/route.ts
touch app/api/v1/screenings/\[...route\]/route.ts
touch app/api/v1/referrals/\[...route\]/route.ts
touch app/api/v1/diagnostics/\[...route\]/route.ts
touch app/api/v1/notifications/\[...route\]/route.ts
touch app/api/v1/operational-logs/\[...route\]/route.ts
touch app/api/v1/dashboard/\[...route\]/route.ts
touch app/api/v1/exports/\[...route\]/route.ts
touch app/api/v1/corrections/\[...route\]/route.ts
touch app/api/v1/users/\[...route\]/route.ts
touch app/api/v1/sites/\[...route\]/route.ts

# API v1 - Webhooks (specific endpoints, not catch-all)
mkdir -p app/api/v1/webhooks/africastalking
mkdir -p app/api/v1/webhooks/whatsapp
touch app/api/v1/webhooks/africastalking/route.ts
touch app/api/v1/webhooks/whatsapp/route.ts

# ============================================
# COMPONENTS
# ============================================

mkdir -p components/ui
mkdir -p components/layout
mkdir -p components/children
mkdir -p components/screening
mkdir -p components/dashboard
mkdir -p components/forms

# ============================================
# LIB
# ============================================

# Pathway
mkdir -p lib/pathway
touch lib/pathway/engine.ts
touch lib/pathway/engine.test.ts
touch lib/pathway/types.ts

# Search
mkdir -p lib/search
touch lib/search/fuzzyMatch.ts

# Notifications
mkdir -p lib/notifications
touch lib/notifications/scheduler.ts

# Validation
mkdir -p lib/validation
touch lib/validation/schemas.ts

# Export
mkdir -p lib/export
touch lib/export/fieldMetadata.ts
touch lib/export/themes.ts

# AI
mkdir -p lib/ai
touch lib/ai/README.md
touch lib/ai/.gitkeep

# Utils
mkdir -p lib/utils
touch lib/utils/sanitise.ts
touch lib/utils/encryption.ts
touch lib/utils/researchId.ts

# ============================================
# PRISMA
# ============================================

mkdir -p prisma/migrations
touch prisma/schema.prisma
touch prisma/seed.ts

# ============================================
# JOBS (BullMQ Workers)
# ============================================

mkdir -p jobs
touch jobs/notifications.worker.ts
touch jobs/exports.worker.ts
touch jobs/quality-snapshots.worker.ts

# ============================================
# ROOT LEVEL FILES
# ============================================

touch middleware.ts
touch CHANGELOG.md
touch .env.example
touch .env

# ============================================
# DOCS
# ============================================

mkdir -p docs/ops
mkdir -p docs/security
touch docs/ops/recovery-runbook.md
touch docs/security/threat-model.md
# Note: zap-report-prelaunch.html will be generated later, but creating placeholder
touch docs/security/zap-report-prelaunch.html

# ============================================
# SUMMARY
# ============================================

echo ""
echo "✅ Project structure created successfully!"
echo ""
echo "📁 Created:"
echo "  - $(find app -type f -name "*.tsx" -o -name "*.ts" 2>/dev/null | wc -l) files in app/"
echo "  - $(find components -type f 2>/dev/null | wc -l) files in components/"
echo "  - $(find lib -type f 2>/dev/null | wc -l) files in lib/"
echo "  - $(find prisma -type f 2>/dev/null | wc -l) files in prisma/"
echo "  - $(find jobs -type f 2>/dev/null | wc -l) files in jobs/"
echo ""
echo "📝 Next steps:"
echo "  1. Run: npm install"
echo "  2. Set up your .env file with database credentials"
echo "  3. Run: npx prisma generate"
echo "  4. Run: npx prisma db push"