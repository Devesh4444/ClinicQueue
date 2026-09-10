import express, { Request, Response } from 'express';
import cors from 'cors';
import crypto from 'crypto';
import db from './db';
import { dispatchWebhook } from './webhook';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// 1. GET ALL DOCTORS WITH LIVE QUEUE LENGTHS
app.get('/api/doctors', (req: Request, res: Response) => {
  const doctors = db.prepare(`
    SELECT d.*, 
      (SELECT COUNT(*) FROM tokens t WHERE t.doctor_id = d.id AND t.queue_status IN ('WAITING', 'SERVING')) as queue_length
    FROM doctors d
  `).all();
  res.json(doctors);
});

// 2. GET SINGLE DOCTOR QUEUE & CLINIC
app.get('/api/queue', (req: Request, res: Response) => {
  const doctorId = (req.query.doctorId as string) || 'doc-1';

  const clinic = db.prepare('SELECT * FROM clinics LIMIT 1').get();
  const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(doctorId);
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
  const { clinicId, doctorId, patientName, phone, isWalkIn } = req.body;

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
      id, token_number, clinic_id, doctor_id, patient_name, phone,
      is_emergency, check_in_status, queue_status, position, mock_transit_duration_min
    ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, 'WAITING', ?, ?)
  `);

  insertStmt.run(
    tokenId,
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