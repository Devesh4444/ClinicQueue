import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(__dirname, 'clinic_queue.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS clinics (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    distance_km REAL NOT NULL,
    mock_transit_minutes INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS doctors (
    id TEXT PRIMARY KEY,
    clinic_id TEXT NOT NULL,
    name TEXT NOT NULL,
    specialty TEXT NOT NULL,
    schedule TEXT NOT NULL,
    avg_consult_min INTEGER NOT NULL,
    std_dev_min INTEGER NOT NULL,
    token_price REAL NOT NULL DEFAULT 15.0,
    experience TEXT NOT NULL DEFAULT '10+ yrs exp',
    qualifications TEXT NOT NULL DEFAULT 'MBBS, MD',
    FOREIGN KEY (clinic_id) REFERENCES clinics(id)
  );

  CREATE TABLE IF NOT EXISTS queue_states (
    doctor_id TEXT PRIMARY KEY,
    current_stage TEXT NOT NULL DEFAULT 'READY',
    break_duration_min INTEGER DEFAULT 0,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id)
  );

  CREATE TABLE IF NOT EXISTS tokens (
    id TEXT PRIMARY KEY,
    token_number TEXT NOT NULL,
    clinic_id TEXT NOT NULL,
    doctor_id TEXT NOT NULL,
    patient_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    is_emergency INTEGER DEFAULT 0,
    check_in_status TEXT DEFAULT 'NOT_CHECKED_IN',
    queue_status TEXT DEFAULT 'WAITING',
    reschedule_count INTEGER DEFAULT 0,
    position INTEGER NOT NULL,
    mock_transit_duration_min INTEGER DEFAULT 14,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (clinic_id) REFERENCES clinics(id),
    FOREIGN KEY (doctor_id) REFERENCES doctors(id)
  );

  CREATE TABLE IF NOT EXISTS webhook_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    status_code INTEGER,
    response_body TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed default clinic and doctors if empty
const clinicCount = db.prepare('SELECT count(*) as count FROM clinics').get() as { count: number };
if (clinicCount.count === 0) {
  db.prepare(`
    INSERT INTO clinics (id, name, address, distance_km, mock_transit_minutes) 
    VALUES (?, ?, ?, ?, ?)
  `).run('clinic-1', 'City Care Polyclinic', '42 Healthway Ave, Suite 100', 4.8, 14);

  const insertDoc = db.prepare(`
    INSERT INTO doctors (id, clinic_id, name, specialty, schedule, avg_consult_min, std_dev_min, token_price, experience, qualifications) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertDoc.run('doc-1', 'clinic-1', 'Dr. Sharma', 'General Medicine', 'Mon - Fri, 9:00 AM - 1:00 PM', 10, 3, 10.0, '14 yrs exp', 'MBBS, MD (Internal Med)');
  insertDoc.run('doc-2', 'clinic-1', 'Dr. Priya Patel', 'Pediatrics', 'Mon - Sat, 2:00 PM - 6:00 PM', 12, 4, 15.0, '9 yrs exp', 'MBBS, DCH (Pediatrics)');
  insertDoc.run('doc-3', 'clinic-1', 'Dr. Aris Thorne', 'Orthopedics', 'Tue - Thu, 10:00 AM - 4:00 PM', 15, 5, 25.0, '18 yrs exp', 'MBBS, MS (Orthopedics)');
  insertDoc.run('doc-4', 'clinic-1', 'Dr. Ananya Sen', 'Dermatology', 'Wed - Sun, 11:00 AM - 3:00 PM', 8, 2, 20.0, '7 yrs exp', 'MBBS, DVD (Dermatology)');

  const insertState = db.prepare('INSERT INTO queue_states (doctor_id, current_stage) VALUES (?, ?)');
  ['doc-1', 'doc-2', 'doc-3', 'doc-4'].forEach((id) => insertState.run(id, 'READY'));

  // Seed sample active patients
  const insertToken = db.prepare(`
    INSERT INTO tokens (id, token_number, clinic_id, doctor_id, patient_name, phone, is_emergency, check_in_status, queue_status, position, mock_transit_duration_min)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  // Dr. Sharma queue
  insertToken.run('mock-1', 'A-01', 'clinic-1', 'doc-1', 'Rohan Verma', '9876543210', 0, 'CHECKED_IN', 'WAITING', 1, 14);
  insertToken.run('mock-2', 'A-02', 'clinic-1', 'doc-1', 'Meera Rao', '9123456780', 0, 'NOT_CHECKED_IN', 'WAITING', 2, 14);
  insertToken.run('mock-3', 'A-03', 'clinic-1', 'doc-1', 'Kunal Shah', '9988771122', 0, 'NOT_CHECKED_IN', 'WAITING', 3, 14);

  // Dr. Priya Patel queue
  insertToken.run('mock-4', 'B-01', 'clinic-1', 'doc-2', 'Baby Aanya', '9811122334', 0, 'CHECKED_IN', 'WAITING', 1, 14);
  insertToken.run('mock-5', 'B-02', 'clinic-1', 'doc-2', 'Kabir Malhotra', '9722233445', 0, 'NOT_CHECKED_IN', 'WAITING', 2, 14);
}

export default db;