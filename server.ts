import express, { Request, Response } from 'express';
import cors from 'cors';
import crypto from 'crypto';
import db from './db';
import { dispatchWebhook } from './webhook';
import { hashPassword, verifyPassword, generateToken, verifyToken } from './auth';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// 0. AUTHENTICATION ENDPOINTS
app.post('/api/auth/signup', async (req: Request, res: Response) => {
  try {
    const { fullName, email, phone, password, firebaseUid } = req.body;
    if (!fullName || !email || !phone || !password) {
      return res.status(400).json({ error: 'fullName, email, phone, and password are required' });
    }

    const cleanPhone = phone.trim();
    const cleanEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existing = db.prepare('SELECT id, phone, email FROM users WHERE phone = ? OR email = ?').get(cleanPhone, cleanEmail) as any;
    if (existing) {
      if (existing.phone === cleanPhone) {
        return res.status(409).json({ error: 'An account with this phone number already exists' });
      }
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await hashPassword(password);
    const userId = crypto.randomUUID();

    db.prepare(`
      INSERT INTO users (id, full_name, email, phone, password_hash, firebase_uid)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, fullName.trim(), cleanEmail, cleanPhone, passwordHash, firebaseUid || null);

    const user = { id: userId, full_name: fullName.trim(), email: cleanEmail, phone: cleanPhone };
    const token = generateToken(user);

    res.status(201).json({ success: true, user, token });
  } catch (error: any) {
    console.error('Signup error:', error);
    res.status(500).json({ error: error.message || 'Signup failed' });
  }
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ error: 'phone and password are required' });
    }

    const cleanPhone = phone.trim();
    const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(cleanPhone) as any;
    if (!user) {
      return res.status(401).json({ error: 'Invalid phone number or password' });
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid phone number or password' });
    }

    const safeUser = {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      created_at: user.created_at,
    };
    const token = generateToken(safeUser);

    res.json({ success: true, user: safeUser, token });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message || 'Login failed' });
  }
});

app.get('/api/auth/me', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header missing' });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const user = db.prepare('SELECT id, full_name, email, phone, created_at FROM users WHERE id = ?').get(decoded.userId) as any;
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ user });
});

app.put('/api/auth/profile', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header missing' });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const { fullName, email } = req.body;
  if (!fullName || !email) {
    return res.status(400).json({ error: 'fullName and email are required' });
  }

  db.prepare('UPDATE users SET full_name = ?, email = ? WHERE id = ?')
    .run(fullName.trim(), email.trim().toLowerCase(), decoded.userId);

  const updatedUser = db.prepare('SELECT id, full_name, email, phone, created_at FROM users WHERE id = ?').get(decoded.userId) as any;
  const newToken = generateToken(updatedUser);

  res.json({ success: true, user: updatedUser, token: newToken });
});

app.get('/api/user/tokens', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header missing' });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const userTokens = db.prepare(`
    SELECT t.*, 
      d.name as doctor_name, d.specialty as doctor_specialty, d.avg_consult_min,
      c.name as clinic_name, c.address as clinic_address, c.distance_km
    FROM tokens t
    JOIN doctors d ON t.doctor_id = d.id
    JOIN clinics c ON t.clinic_id = c.id
    WHERE t.user_id = ? OR t.phone = ?
    ORDER BY t.created_at DESC
  `).all(decoded.userId, decoded.phone);

  res.json(userTokens);
});

// 1. GET ALL DOCTORS WITH RICH CLINIC DATA, SEARCH & FILTERS
app.get('/api/doctors', (req: Request, res: Response) => {
  const { search, department, maxPrice, maxDistance, sortBy } = req.query;

  let query = `
    SELECT d.*, 
      c.name as clinic_name, 
      c.address as clinic_address, 
      c.neighborhood, 
      c.distance_km, 
      c.mock_transit_minutes, 
      c.rating as clinic_rating,
      (SELECT COUNT(*) FROM tokens t WHERE t.doctor_id = d.id AND t.queue_status IN ('WAITING', 'SERVING')) as queue_length
    FROM doctors d
    JOIN clinics c ON d.clinic_id = c.id
    WHERE 1=1
  `;

  const params: any[] = [];

  if (department && department !== 'All') {
    query += ' AND d.specialty LIKE ?';
    params.push(`%${department}%`);
  }

  if (search) {
    query += ` AND (
      d.name LIKE ? OR 
      d.specialty LIKE ? OR 
      c.name LIKE ? OR 
      c.neighborhood LIKE ?
    )`;
    const searchWild = `%${search}%`;
    params.push(searchWild, searchWild, searchWild, searchWild);
  }

  if (maxPrice) {
    query += ' AND d.token_price <= ?';
    params.push(Number(maxPrice));
  }

  if (maxDistance) {
    query += ' AND c.distance_km <= ?';
    params.push(Number(maxDistance));
  }

  if (sortBy === 'distance') {
    query += ' ORDER BY c.distance_km ASC';
  } else if (sortBy === 'rating') {
    query += ' ORDER BY d.rating DESC, d.review_count DESC';
  } else if (sortBy === 'price_asc') {
    query += ' ORDER BY d.token_price ASC';
  } else if (sortBy === 'price_desc') {
    query += ' ORDER BY d.token_price DESC';
  } else {
    query += ' ORDER BY c.distance_km ASC, d.rating DESC';
  }

  const doctors = db.prepare(query).all(...params);
  res.json(doctors);
});

// 2. GET SINGLE DOCTOR QUEUE & CLINIC
app.get('/api/queue', (req: Request, res: Response) => {
  const doctorId = (req.query.doctorId as string) || 'doc-1';

  const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(doctorId) as any;
  const clinicId = doctor?.clinic_id || 'clinic-1';
  const clinic = db.prepare('SELECT * FROM clinics WHERE id = ?').get(clinicId);
  const state = db.prepare('SELECT * FROM queue_states WHERE doctor_id = ?').get(doctorId);
  const activeTokens = db.prepare(`
    SELECT * FROM tokens 
    WHERE doctor_id = ? AND queue_status IN ('WAITING', 'SERVING')
    ORDER BY position ASC
  `).all(doctorId);

  res.json({ clinic, doctor, queueState: state, activeQueue: activeTokens });
});

// 3. BOOK TOKEN (Online or Walk-in)
app.post('/api/queue', async (req: Request, res: Response) => {
  const { clinicId, doctorId, patientName, phone, isWalkIn, userId } = req.body;

  if (!doctorId || !clinicId) {
    return res.status(400).json({ error: 'doctorId and clinicId are required' });
  }

  const posRow = db.prepare(`
    SELECT COALESCE(MAX(position), 0) as maxPos FROM tokens 
    WHERE doctor_id = ? AND queue_status IN ('WAITING', 'SERVING')
  `).get(doctorId) as { maxPos: number };

  const nextPos = posRow.maxPos + 1;
  const prefix = doctorId === 'doc-2' ? 'B' : doctorId === 'doc-3' ? 'C' : doctorId === 'doc-4' ? 'D' : 'A';
  const tokenNumber = `${prefix}-${String(nextPos).padStart(2, '0')}`;
  const tokenId = crypto.randomUUID();

  const clinic = db.prepare('SELECT mock_transit_minutes FROM clinics WHERE id = ?').get(clinicId) as { mock_transit_minutes: number };
  const transitMins = isWalkIn ? 0 : (clinic?.mock_transit_minutes || 14);

  const insertStmt = db.prepare(`
    INSERT INTO tokens (
      id, user_id, token_number, clinic_id, doctor_id, patient_name, phone,
      is_emergency, check_in_status, queue_status, position, mock_transit_duration_min
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 'WAITING', ?, ?)
  `);

  insertStmt.run(
    tokenId,
    userId || null,
    tokenNumber,
    clinicId,
    doctorId,
    patientName || (isWalkIn ? 'Walk-in Patient' : 'Online Patient'),
    phone || 'N/A',
    isWalkIn ? 'CHECKED_IN' : 'NOT_CHECKED_IN',
    nextPos,
    transitMins
  );

  if (phone && phone !== 'N/A') {
    await dispatchWebhook({
      event: 'TOKEN_CREATED',
      timestamp: new Date().toISOString(),
      recipientPhone: phone,
      patientName: patientName || 'Patient',
      tokenNumber,
      message: `Your token ${tokenNumber} is confirmed. Position: #${nextPos}.`,
    });
  }

  res.json({ success: true, tokenId, tokenNumber, position: nextPos });
});

// 4. ADMIN CONTROLS (Stage progress, Break, Check-in, Emergency, Escalate Existing)
app.post('/api/queue/control', async (req: Request, res: Response) => {
  const { action, doctorId, tokenId, breakDurationMin, stage } = req.body;

  if (!doctorId) {
    return res.status(400).json({ error: 'doctorId is required' });
  }

  // Set Stage
  if (action === 'SET_STAGE') {
    db.prepare('UPDATE queue_states SET current_stage = ? WHERE doctor_id = ?').run(stage, doctorId);
    return res.json({ success: true, stage });
  }

  // Set Break
  if (action === 'SET_BREAK') {
    db.prepare(`
      UPDATE queue_states 
      SET current_stage = 'BREAK', break_duration_min = ? 
      WHERE doctor_id = ?
    `).run(breakDurationMin || 15, doctorId);

    await dispatchWebhook({
      event: 'DOCTOR_BREAK',
      timestamp: new Date().toISOString(),
      recipientPhone: 'ALL_WAITING',
      patientName: 'Clinic Desk',
      tokenNumber: 'INFO',
      message: `Doctor is taking a ${breakDurationMin || 15}-minute break.`,
    });

    return res.json({ success: true, stage: 'BREAK' });
  }

  // Check In
  if (action === 'CHECK_IN') {
    if (!tokenId) return res.status(400).json({ error: 'tokenId required' });
    db.prepare("UPDATE tokens SET check_in_status = 'CHECKED_IN' WHERE id = ?").run(tokenId);
    return res.json({ success: true });
  }

  // Complete current token & pop queue head
  if (action === 'COMPLETE_CURRENT') {
    const headToken = db.prepare(`
      SELECT * FROM tokens 
      WHERE doctor_id = ? AND queue_status IN ('WAITING', 'SERVING')
      ORDER BY position ASC LIMIT 1
    `).get(doctorId) as any;

    if (!headToken) {
      return res.status(400).json({ error: 'No active patient to complete' });
    }

    const transaction = db.transaction(() => {
      db.prepare("UPDATE tokens SET queue_status = 'COMPLETED' WHERE id = ?").run(headToken.id);
      db.prepare(`
        UPDATE tokens 
        SET position = position - 1 
        WHERE doctor_id = ? AND queue_status = 'WAITING'
      `).run(doctorId);
      db.prepare("UPDATE queue_states SET current_stage = 'READY', break_duration_min = 0 WHERE doctor_id = ?").run(doctorId);
    });

    transaction();

    const nextPatient = db.prepare(`
      SELECT * FROM tokens 
      WHERE doctor_id = ? AND queue_status = 'WAITING' AND position = 1
    `).get(doctorId) as any;

    if (nextPatient && nextPatient.phone && nextPatient.phone !== 'N/A') {
      await dispatchWebhook({
        event: 'PATIENT_NEXT',
        timestamp: new Date().toISOString(),
        recipientPhone: nextPatient.phone,
        patientName: nextPatient.patient_name,
        tokenNumber: nextPatient.token_number,
        message: `Token ${nextPatient.token_number}: You are next in line. Please proceed to the clinic desk.`,
      });
    }

    return res.json({ success: true, completedToken: headToken.token_number });
  }

  // ESCALATE AN EXISTING PERSON IN QUEUE TO EMERGENCY
  if (action === 'PROMOTE_TO_EMERGENCY') {
    if (!tokenId) return res.status(400).json({ error: 'tokenId required' });

    const targetPatient = db.prepare('SELECT * FROM tokens WHERE id = ?').get(tokenId) as any;
    if (!targetPatient) return res.status(404).json({ error: 'Token not found' });
    if (targetPatient.is_emergency === 1) return res.status(400).json({ error: 'Patient is already emergency' });

    const oldPos = targetPatient.position;

    const transaction = db.transaction(() => {
      // If position 1 is already serving, move to position 2; if at 1, stays at 1
      const targetPos = 1;

      // Shift everyone that was ahead of this patient down by 1
      db.prepare(`
        UPDATE tokens 
        SET position = position + 1 
        WHERE doctor_id = ? AND queue_status IN ('WAITING', 'SERVING') 
          AND position >= ? AND position < ?
      `).run(doctorId, targetPos, oldPos);

      // Set target patient to position 1 and mark emergency
      db.prepare(`
        UPDATE tokens 
        SET position = ?, is_emergency = 1, check_in_status = 'CHECKED_IN' 
        WHERE id = ?
      `).run(targetPos, tokenId);
    });

    transaction();

    await dispatchWebhook({
      event: 'EMERGENCY_INJECTED',
      timestamp: new Date().toISOString(),
      recipientPhone: 'ALL_WAITING',
      patientName: targetPatient.patient_name,
      tokenNumber: targetPatient.token_number,
      message: `🚨 Token ${targetPatient.token_number} (${targetPatient.patient_name}) escalated to EMERGENCY. Downstream patients shifted back.`,
    });

    return res.json({ success: true, promotedToken: targetPatient.token_number });
  }

  return res.status(400).json({ error: 'Invalid action' });
});

// 5. RESCHEDULE (Max 1)
app.post('/api/queue/reschedule', async (req: Request, res: Response) => {
  const { tokenId } = req.body;
  if (!tokenId) return res.status(400).json({ error: 'tokenId is required' });

  const patient = db.prepare('SELECT * FROM tokens WHERE id = ?').get(tokenId) as any;
  if (!patient) return res.status(404).json({ error: 'Token not found' });

  if (patient.reschedule_count >= 1) {
    return res.status(403).json({ error: 'Same-day reschedule limit reached (max 1 allowed)' });
  }

  const doctorId = patient.doctor_id;
  const currentPos = patient.position;

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE tokens 
      SET position = position - 1 
      WHERE doctor_id = ? AND queue_status = 'WAITING' AND position > ?
    `).run(doctorId, currentPos);

    const maxRow = db.prepare(`
      SELECT COALESCE(MAX(position), 0) as maxPos 
      FROM tokens 
      WHERE doctor_id = ? AND queue_status = 'WAITING'
    `).get(doctorId) as { maxPos: number };

    const newPos = maxRow.maxPos + 1;

    db.prepare(`
      UPDATE tokens 
      SET position = ?, reschedule_count = reschedule_count + 1 
      WHERE id = ?
    `).run(newPos, tokenId);

    return newPos;
  });

  const finalPos = transaction();

  res.json({ success: true, tokenNumber: patient.token_number, newPosition: finalPos });
});

app.listen(PORT, () => {
  console.log(`Queue API Backend running on http://localhost:${PORT}`);
});