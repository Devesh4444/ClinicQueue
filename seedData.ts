import type Database from 'better-sqlite3';

export interface ClinicData {
  id: string;
  name: string;
  address: string;
  neighborhood: string;
  distance_km: number;
  mock_transit_minutes: number;
  rating: number;
  review_count: number;
}

export interface DoctorData {
  id: string;
  clinic_id: string;
  name: string;
  specialty: string;
  schedule: string;
  avg_consult_min: number;
  std_dev_min: number;
  token_price: number;
  experience: string;
  qualifications: string;
  rating: number;
  review_count: number;
}

export const SEED_CLINICS: ClinicData[] = [
  { id: 'clinic-1', name: 'St. Jude Multispecialty Hospital', address: '102 Downtown Way', neighborhood: 'Downtown', distance_km: 1.2, mock_transit_minutes: 8, rating: 4.8, review_count: 342 },
  { id: 'clinic-2', name: 'Metro Heart & Diabetes Institute', address: '405 Medical Plaza Blvd', neighborhood: 'Medical District', distance_km: 2.5, mock_transit_minutes: 12, rating: 4.9, review_count: 520 },
  { id: 'clinic-3', name: 'City Care Polyclinic', address: '42 Healthway Ave, Suite 100', neighborhood: 'Midtown', distance_km: 3.4, mock_transit_minutes: 14, rating: 4.7, review_count: 215 },
  { id: 'clinic-4', name: 'Apex Orthopedic & Spine Center', address: '78 Westgate Terrace', neighborhood: 'Westside', distance_km: 4.8, mock_transit_minutes: 16, rating: 4.8, review_count: 190 },
  { id: 'clinic-5', name: 'Nova Dermatology & Skin Clinic', address: '215 Uptown Boulevard', neighborhood: 'Uptown', distance_km: 5.2, mock_transit_minutes: 18, rating: 4.6, review_count: 145 },
  { id: 'clinic-6', name: 'Harmony Pediatric Health Center', address: '88 Oak Park Drive', neighborhood: 'Oak Park', distance_km: 6.0, mock_transit_minutes: 20, rating: 4.9, review_count: 380 },
  { id: 'clinic-7', name: 'Prime Health Care Hospital', address: '304 Bayside Marina Rd', neighborhood: 'Bayside', distance_km: 7.1, mock_transit_minutes: 22, rating: 4.5, review_count: 275 },
  { id: 'clinic-8', name: 'Silver Oak Cardiology Clinic', address: '12 South Hills Ave', neighborhood: 'South Hills', distance_km: 8.4, mock_transit_minutes: 25, rating: 4.9, review_count: 410 },
  { id: 'clinic-9', name: 'Green Valley Family Hospital', address: '550 Greenwood Expressway', neighborhood: 'Greenwood', distance_km: 9.2, mock_transit_minutes: 26, rating: 4.4, review_count: 165 },
  { id: 'clinic-10', name: 'Cedar Crest Medical Institute', address: '19 River North Way', neighborhood: 'River North', distance_km: 10.5, mock_transit_minutes: 28, rating: 4.8, review_count: 310 },
  { id: 'clinic-11', name: 'Sunrise Diabetology & Endocrine Care', address: '730 East End Highway', neighborhood: 'East End', distance_km: 11.2, mock_transit_minutes: 30, rating: 4.7, review_count: 188 },
  { id: 'clinic-12', name: 'Crestview Neurological Institute', address: '64 Highland Peak Rd', neighborhood: 'Highland', distance_km: 12.0, mock_transit_minutes: 32, rating: 4.9, review_count: 290 },
  { id: 'clinic-13', name: 'Mercy General Hospital', address: '900 Old Town Square', neighborhood: 'Old Town', distance_km: 13.4, mock_transit_minutes: 35, rating: 4.3, review_count: 430 },
  { id: 'clinic-14', name: 'Beacon ENT & Sinus Center', address: '312 North Hills Pass', neighborhood: 'North Hills', distance_km: 14.1, mock_transit_minutes: 36, rating: 4.6, review_count: 155 },
  { id: 'clinic-15', name: 'Evergreen Gastro & Liver Clinic', address: '48 Lakeside Crescent', neighborhood: 'Lakeside', distance_km: 15.3, mock_transit_minutes: 38, rating: 4.8, review_count: 220 },
  { id: 'clinic-16', name: 'Pinnacle Wellness Hospital', address: '110 University Circle', neighborhood: 'University Heights', distance_km: 16.5, mock_transit_minutes: 40, rating: 4.7, review_count: 340 },
  { id: 'clinic-17', name: 'Golden Gate Eye & Retina Institute', address: '500 Harbor View Way', neighborhood: 'Harbor District', distance_km: 17.2, mock_transit_minutes: 42, rating: 4.9, review_count: 195 },
  { id: 'clinic-18', name: 'Valley Care Medical Plaza', address: '820 Valley View Road', neighborhood: 'Valley View', distance_km: 18.0, mock_transit_minutes: 44, rating: 4.4, review_count: 175 },
  { id: 'clinic-19', name: 'Summit Chest & Pulmonology Center', address: '95 Summit Ridge Blvd', neighborhood: 'Summit Ridge', distance_km: 19.4, mock_transit_minutes: 46, rating: 4.8, review_count: 210 },
  { id: 'clinic-20', name: 'Lifeline Multispecialty Clinic', address: '100 Central Park West', neighborhood: 'Central Park', distance_km: 20.2, mock_transit_minutes: 48, rating: 4.6, review_count: 265 },
  { id: 'clinic-21', name: 'Trinity Health Pavillion', address: '344 West End Avenue', neighborhood: 'West End', distance_km: 21.0, mock_transit_minutes: 50, rating: 4.5, review_count: 190 },
  { id: 'clinic-22', name: 'Paramount Arthritis & Sports Clinic', address: '610 Grand Avenue', neighborhood: 'Grand Ave', distance_km: 22.1, mock_transit_minutes: 52, rating: 4.7, review_count: 140 },
  { id: 'clinic-23', name: 'Parkway Children\'s Hospital', address: '777 Parkway District Dr', neighborhood: 'Parkway', distance_km: 22.8, mock_transit_minutes: 54, rating: 4.9, review_count: 480 },
  { id: 'clinic-24', name: 'Wellspring Endocrinology Center', address: '280 Canyon Crest Way', neighborhood: 'Canyon Crest', distance_km: 23.6, mock_transit_minutes: 55, rating: 4.6, review_count: 125 },
  { id: 'clinic-25', name: 'Horizon Memorial Hospital', address: '990 Airport Boulevard', neighborhood: 'Airport Plaza', distance_km: 24.8, mock_transit_minutes: 58, rating: 4.4, review_count: 310 },
];

const SPECIALTIES = [
  'Cardiologist',
  'Diabetologist',
  'Dermatologist',
  'Orthopedic Surgeon',
  'Neurologist',
  'Pediatrician',
  'ENT Specialist',
  'General Physician',
  'Gastroenterologist',
  'Pulmonologist',
  'Endocrinologist',
  'Ophthalmologist',
  'Psychiatrist',
  'Gynecologist',
];

const DOCTOR_NAMES = [
  'Dr. Rajesh Sharma', 'Dr. Priya Patel', 'Dr. Vikram Malhotra', 'Dr. Ananya Sen',
  'Dr. Kabir Mehta', 'Dr. Sunita Rao', 'Dr. Rohan Verma', 'Dr. Deepa Iyer',
  'Dr. Aris Thorne', 'Dr. Meera Nambiar', 'Dr. Siddharth Joshi', 'Dr. Kavita Nair',
  'Dr. Alok Bannerjee', 'Dr. Neha Kapoor', 'Dr. Sanjay Deshmukh', 'Dr. Pooja Kulkarni',
  'Dr. Tariq Ahmed', 'Dr. Swati Ghosh', 'Dr. Gautam Singhania', 'Dr. Ritu Choudhury',
  'Dr. Vivek Saxena', 'Dr. Vandana Reddy', 'Dr. Manoj Tiwari', 'Dr. Shreya Menon',
  'Dr. Farhan Qureshi', 'Dr. Natasha Bose', 'Dr. Harshavardhan Rao', 'Dr. Divya Aggarwal',
  'Dr. Amitav Bhattacharya', 'Dr. Shalini Pillai', 'Dr. Pradeep Narang', 'Dr. Tanya Oberoi',
  'Dr. Arvind Swaminathan', 'Dr. Pallavi Sengupta', 'Dr. Raghavendra Das', 'Dr. Sneha Hegde',
  'Dr. Chetan Bhagat', 'Dr. Radhika Madan', 'Dr. Bhaskar Murthy', 'Dr. Jyoti Varma',
  'Dr. Nikhil Mittal', 'Dr. Monica Geller', 'Dr. Ross Geller', 'Dr. Rachel Green',
  'Dr. Chandler Bing', 'Dr. Sarah Jenkins', 'Dr. Marcus Vance', 'Dr. Elena Rostova',
  'Dr. Arthur Pendelton', 'Dr. Claire Beauchamp', 'Dr. Lucas Scott', 'Dr. Nathan Drake',
  'Dr. Maya Lin', 'Dr. Julian Bashir', 'Dr. Beverly Crusher', 'Dr. Leonard McCoy',
  'Dr. Gregory House', 'Dr. James Wilson', 'Dr. Lisa Cuddy', 'Dr. Robert Chase',
  'Dr. Allison Cameron', 'Dr. Eric Foreman', 'Dr. Chris Turk', 'Dr. John Dorian',
  'Dr. Elliot Reid', 'Dr. Perry Cox', 'Dr. Meredith Grey', 'Dr. Derek Shepherd',
  'Dr. Cristina Yang', 'Dr. Miranda Bailey', 'Dr. Alex Karev', 'Dr. Richard Webber',
  'Dr. Callie Torres', 'Dr. Mark Sloan', 'Dr. Arizona Robbins', 'Dr. Owen Hunt',
  'Dr. Jackson Avery', 'Dr. April Kepner', 'Dr. Jo Wilson', 'Dr. Andrew DeLuca',
  'Dr. Shaun Murphy', 'Dr. Aaron Glassman', 'Dr. Claire Browne', 'Dr. Neil Melendez',
  'Dr. Morgan Reznick', 'Dr. Marcus Andrews', 'Dr. Audrey Lim', 'Dr. Alex Park',
  'Dr. Max Goodwin', 'Dr. Helen Sharpe', 'Dr. Floyd Reynolds', 'Dr. Lauren Bloom',
  'Dr. Iggy Frome', 'Dr. Vijay Kapoor', 'Dr. Elizabeth Corday', 'Dr. John Carter',
  'Dr. Kerry Weaver', 'Dr. Mark Greene', 'Dr. Peter Benton', 'Dr. Doug Ross',
];

const QUALIFICATIONS_MAP: Record<string, string[]> = {
  'Cardiologist': ['MBBS, MD, DM (Cardiology)', 'MBBS, DNB (Cardio), FACC', 'MBBS, MD, FESC'],
  'Diabetologist': ['MBBS, MD, Fellowship in Diabetology', 'MBBS, Postgrad Diab (UK)', 'MBBS, MD (Medicine), CCEBDM'],
  'Dermatologist': ['MBBS, MD (Dermatology)', 'MBBS, DVD, FAAD', 'MBBS, MD, DNB (Derm)'],
  'Orthopedic Surgeon': ['MBBS, MS (Orthopedics)', 'MBBS, DNB (Ortho), MCh', 'MBBS, MS, Fellowship Joint Replacement'],
  'Neurologist': ['MBBS, MD, DM (Neurology)', 'MBBS, DNB (Neuro), FAAN', 'MBBS, MD, Fellowship Stroke Medicine'],
  'Pediatrician': ['MBBS, MD (Pediatrics)', 'MBBS, DCH, DNB', 'MBBS, MD, Fellowship Neonatology'],
  'ENT Specialist': ['MBBS, MS (ENT)', 'MBBS, DLO, DNB', 'MBBS, MS (Otorhinolaryngology)'],
  'General Physician': ['MBBS, MD (Internal Medicine)', 'MBBS, DNB (Family Med)', 'MBBS, MRCGP'],
  'Gastroenterologist': ['MBBS, MD, DM (Gastro)', 'MBBS, DNB (Gastroenterology)', 'MBBS, MD, FACG'],
  'Pulmonologist': ['MBBS, MD (Pulmonary Med)', 'MBBS, DTCD, FCCP', 'MBBS, MD (Respiratory Diseases)'],
  'Endocrinologist': ['MBBS, MD, DM (Endocrinology)', 'MBBS, FACE (Endocrine)', 'MBBS, MD, DNB'],
  'Ophthalmologist': ['MBBS, MS (Ophthalmology)', 'MBBS, DO, DNB (Retina)', 'MBBS, MS, FRCS (Ophth)'],
  'Psychiatrist': ['MBBS, MD (Psychiatry)', 'MBBS, DPM, DNB', 'MBBS, MRCPsych (UK)'],
  'Gynecologist': ['MBBS, MS (OBG)', 'MBBS, DGO, DNB', 'MBBS, MD (Gynecology), FICOG'],
};

const SCHEDULES = [
  'Mon - Fri, 9:00 AM - 1:00 PM',
  'Mon - Sat, 2:00 PM - 6:00 PM',
  'Tue - Thu, 10:00 AM - 4:00 PM',
  'Wed - Sun, 11:00 AM - 3:00 PM',
  'Mon, Wed, Fri, 8:30 AM - 12:30 PM',
  'Tue, Thu, Sat, 3:00 PM - 7:00 PM',
];

export function generateSeedData(): { clinics: ClinicData[]; doctors: DoctorData[] } {
  const clinics = SEED_CLINICS;
  const doctors: DoctorData[] = [];

  let docIndex = 0;
  for (let c = 0; c < clinics.length; c++) {
    const clinic = clinics[c];
    // 4 doctors per clinic = 100 doctors across 25 clinics
    for (let d = 0; d < 4; d++) {
      const docId = `doc-${docIndex + 1}`;
      const name = DOCTOR_NAMES[docIndex % DOCTOR_NAMES.length];
      const specialty = SPECIALTIES[(docIndex * 3 + d) % SPECIALTIES.length];
      const quals = QUALIFICATIONS_MAP[specialty] || ['MBBS, MD'];
      const qual = quals[d % quals.length];
      const expYears = 6 + ((docIndex * 7 + d * 3) % 22); // 6 to 27 years
      const price = 20 + (((docIndex * 13 + d * 7) % 15) * 5); // $20 to $90 in steps of $5
      const rating = Number((4.1 + (((docIndex * 17 + d) % 9) * 0.1)).toFixed(1)); // 4.1 to 4.9
      const reviews = 40 + ((docIndex * 23 + d * 11) % 240); // 40 to 280 reviews
      const avgConsult = 8 + ((docIndex + d * 2) % 10); // 8 to 17 mins
      const stdDev = 2 + (d % 3); // 2 to 4 mins
      const schedule = SCHEDULES[(docIndex + d) % SCHEDULES.length];

      doctors.push({
        id: docId,
        clinic_id: clinic.id,
        name,
        specialty,
        schedule,
        avg_consult_min: avgConsult,
        std_dev_min: stdDev,
        token_price: price,
        experience: `${expYears} yrs exp`,
        qualifications: qual,
        rating: Math.min(5.0, rating),
        review_count: reviews,
      });

      docIndex++;
    }
  }

  return { clinics, doctors };
}

export function seedDatabase(db: any): void {
  const countRow = db.prepare('SELECT count(*) as count FROM clinics').get() as { count: number };
  if (countRow.count >= 25) {
    return; // Already populated
  }

  console.log('Seeding 25 clinics and 100 doctors into SQLite...');
  const { clinics, doctors } = generateSeedData();

  db.pragma('foreign_keys = OFF');

  const tx = db.transaction(() => {
    // Clear previous seeds
    db.prepare('DELETE FROM tokens').run();
    db.prepare('DELETE FROM queue_states').run();
    db.prepare('DELETE FROM doctors').run();
    db.prepare('DELETE FROM clinics').run();

    const insertClinic = db.prepare(`
      INSERT INTO clinics (id, name, address, neighborhood, distance_km, mock_transit_minutes, rating, review_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const c of clinics) {
      insertClinic.run(c.id, c.name, c.address, c.neighborhood, c.distance_km, c.mock_transit_minutes, c.rating, c.review_count);
    }

    const insertDoc = db.prepare(`
      INSERT INTO doctors (id, clinic_id, name, specialty, schedule, avg_consult_min, std_dev_min, token_price, experience, qualifications, rating, review_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertState = db.prepare(`
      INSERT INTO queue_states (doctor_id, current_stage, break_duration_min)
      VALUES (?, 'READY', 0)
    `);

    for (const d of doctors) {
      insertDoc.run(
        d.id, d.clinic_id, d.name, d.specialty, d.schedule,
        d.avg_consult_min, d.std_dev_min, d.token_price,
        d.experience, d.qualifications, d.rating, d.review_count
      );
      insertState.run(d.id);
    }

    // Insert a few initial active tokens for the first 3 doctors for live display
    const insertToken = db.prepare(`
      INSERT INTO tokens (id, token_number, clinic_id, doctor_id, patient_name, phone, is_emergency, check_in_status, queue_status, position, mock_transit_duration_min)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, 'WAITING', ?, 14)
    `);

    insertToken.run('mock-1', 'A-01', 'clinic-1', 'doc-1', 'Rohan Verma', '9876543210', 'CHECKED_IN', 1);
    insertToken.run('mock-2', 'A-02', 'clinic-1', 'doc-1', 'Meera Rao', '9123456780', 'NOT_CHECKED_IN', 2);
    insertToken.run('mock-3', 'A-03', 'clinic-1', 'doc-1', 'Kunal Shah', '9988771122', 'NOT_CHECKED_IN', 3);
    insertToken.run('mock-4', 'B-01', 'clinic-1', 'doc-2', 'Baby Aanya', '9811122334', 'CHECKED_IN', 1);
    insertToken.run('mock-5', 'B-02', 'clinic-1', 'doc-2', 'Kabir Malhotra', '9722233445', 'NOT_CHECKED_IN', 2);
  });

  tx();
  db.pragma('foreign_keys = ON');
  console.log('Successfully seeded 25 clinics and 100 doctors!');
}
