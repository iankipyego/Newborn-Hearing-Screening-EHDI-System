import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Create the default site (check if exists first)
  let site = await prisma.site.findFirst({
    where: { name: 'Mama Rachel Hospital' },
  });

  if (!site) {
    site = await prisma.site.create({
      data: {
        name: 'Mama Rachel Hospital',
        county: 'Eldoret',
        subcounty: 'Kapseret',
        contact_person: 'Dr. Jane Doe',
        contact_phone: '+254700000000',
        active: true,
      },
    });
    console.log(`✅ Created site: ${site.name}`);
  } else {
    console.log(`✅ Site already exists: ${site.name}`);
  }

  // 2. Create users for all 5 roles
  const passwordHash = await bcrypt.hash('Test1234!', 10);

  const userData = [
    { name: 'Admin User', email: 'admin@test.com', role: 'ADMIN' },
    { name: 'Data Clerk User', email: 'clerk@test.com', role: 'DATA_CLERK' },
    { name: 'Screener User', email: 'screener@test.com', role: 'SCREENER' },
    { name: 'Supervisor User', email: 'supervisor@test.com', role: 'SUPERVISOR' },
    { name: 'Researcher User', email: 'researcher@test.com', role: 'RESEARCHER' },
  ];

  const users = [];
  for (const data of userData) {
    // Check if user already exists
    let user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: data.name,
          email: data.email,
          phone: `+2547${Math.floor(Math.random() * 90000000) + 10000000}`,
          password_hash: passwordHash,
          role: data.role,
          site_id: site.id,
          active: true,
          totp_enabled: false,
          failed_login_count: 0,
          created_at: new Date(),
        },
      });
      console.log(`✅ Created user: ${user.email} (${user.role})`);
    } else {
      console.log(`✅ User already exists: ${user.email}`);
    }
    users.push(user);
  }

  // 3. Create sample patients
  const clerk = users.find(u => u.role === 'DATA_CLERK')!;
  
  const patientData = [
    {
      research_id: 'MRH-2026-00001',
      hospital_number: 'HOSP-001',
      date_of_birth: new Date('2026-01-15'),
      sex: 'Male',
      birth_weight_grams: 3200,
      gestational_age_weeks: 39.5,
      delivery_type: 'NVD',
      apgar_score_5min: 9,
      mother_name: 'Mary Wanjiku',
      mother_age: 28,
      mother_phone: '+254711111111',
      residence_county: 'Nairobi',
      residence_subcounty: 'Westlands',
      nearest_town: 'Nairobi',
      nicu_admitted: false,
      entry_source: 'LIVE',
    },
    {
      research_id: 'MRH-2026-00002',
      hospital_number: 'HOSP-002',
      date_of_birth: new Date('2026-02-20'),
      sex: 'Female',
      birth_weight_grams: 2800,
      gestational_age_weeks: 36.0,
      delivery_type: 'C_Section',
      apgar_score_5min: 7,
      mother_name: 'Sarah Akinyi',
      mother_age: 32,
      mother_phone: '+254722222222',
      guardian_phone_alt: '+254733333333',
      residence_county: 'Kiambu',
      residence_subcounty: 'Thika',
      nearest_town: 'Thika',
      nicu_admitted: true,
      nicu_days: 7,
      entry_source: 'LIVE',
    },
    {
      research_id: 'MRH-2026-00003',
      hospital_number: 'HOSP-003',
      date_of_birth: new Date('2026-03-10'),
      sex: 'Male',
      birth_weight_grams: 3500,
      gestational_age_weeks: 40.0,
      delivery_type: 'NVD',
      apgar_score_5min: 10,
      mother_name: 'Grace Muthoni',
      mother_age: 25,
      mother_phone: '+254744444444',
      residence_county: 'Nairobi',
      residence_subcounty: 'Kasarani',
      nearest_town: 'Nairobi',
      nicu_admitted: false,
      entry_source: 'LIVE',
    },
  ];

  for (const data of patientData) {
    const patient = await prisma.patient.create({
      data: {
        ...data,
        site_id: site.id,
        created_by: clerk.id,
        created_at: new Date(),
      },
    });
    console.log(`✅ Created patient: ${patient.research_id}`);
  }

  // 4. Create operational logs for the past 30 days
  const supervisor = users.find(u => u.role === 'SUPERVISOR')!;
  const today = new Date();
  
  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    await prisma.operationalLog.create({
      data: {
        log_date: date,
        site_id: site.id,
        total_births: Math.floor(Math.random() * 10) + 5,
        total_screened: Math.floor(Math.random() * 8) + 3,
        total_missed: Math.floor(Math.random() * 3),
        missed_discharged_early: Math.floor(Math.random() * 2),
        missed_refused: Math.floor(Math.random() * 1),
        missed_equipment_down: Math.floor(Math.random() * 1),
        missed_staff_absent: Math.floor(Math.random() * 1),
        avg_screening_time_minutes: Math.floor(Math.random() * 15) + 5,
        equipment_downtime_minutes: Math.floor(Math.random() * 30),
        power_outage_minutes: Math.floor(Math.random() * 10),
        probes_replaced: Math.floor(Math.random() * 2),
        consumable_cost: Math.floor(Math.random() * 500) + 100,
        staff_on_duty_count: Math.floor(Math.random() * 3) + 2,
        recorded_by: supervisor.id,
      },
    });
  }
  console.log('✅ Created 30 days of operational logs');

  console.log('🌱 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });