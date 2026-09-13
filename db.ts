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
    neighborhood TEXT NOT NULL DEFAULT 'Downtown',
    distance_km REAL NOT NULL,
    mock_transit_minutes INTEGER NOT NULL,
    rating REAL NOT NULL DEFAULT 4.6,
    review_count INTEGER NOT NULL DEFAULT 120
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
    rating REAL NOT NULL DEFAULT 4.8,
    review_count INTEGER NOT NULL DEFAULT 85,
    FOREIGN KEY (clinic_id) REFERENCES clinics(id)
  );

  CREATE TABLE IF NOT EXISTS queue_states (
    doctor_id TEXT PRIMARY KEY,
    current_stage TEXT NOT NULL DEFAULT 'READY',
    break_duration_min INTEGER DEFAULT 0,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id)
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    firebase_uid TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT,
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
    FOREIGN KEY (doctor_id) REFERENCES doctors(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
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

// Gracefully add any missing columns to existing tables
try { db.exec('ALTER TABLE tokens ADD COLUMN user_id TEXT REFERENCES users(id)'); } catch {}
try { db.exec("ALTER TABLE clinics ADD COLUMN neighborhood TEXT NOT NULL DEFAULT 'Downtown'"); } catch {}
try { db.exec('ALTER TABLE clinics ADD COLUMN rating REAL NOT NULL DEFAULT 4.6'); } catch {}
try { db.exec('ALTER TABLE clinics ADD COLUMN review_count INTEGER NOT NULL DEFAULT 120'); } catch {}
try { db.exec('ALTER TABLE doctors ADD COLUMN token_price REAL NOT NULL DEFAULT 15.0'); } catch {}
try { db.exec("ALTER TABLE doctors ADD COLUMN experience TEXT NOT NULL DEFAULT '10+ yrs exp'"); } catch {}
try { db.exec("ALTER TABLE doctors ADD COLUMN qualifications TEXT NOT NULL DEFAULT 'MBBS, MD'"); } catch {}
try { db.exec('ALTER TABLE doctors ADD COLUMN rating REAL NOT NULL DEFAULT 4.8'); } catch {}
try { db.exec('ALTER TABLE doctors ADD COLUMN review_count INTEGER NOT NULL DEFAULT 85'); } catch {}

// Seed the 25 clinics and 100 doctors
import { seedDatabase } from './seedData';
seedDatabase(db);

export default db;