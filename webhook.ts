import db from './db';

export type WebhookEvent =
  | 'TOKEN_CREATED'
  | 'EMERGENCY_INJECTED'
  | 'PATIENT_NEXT'
  | 'CONSULTATION_COMPLETED'
  | 'DOCTOR_BREAK'
  | 'PATIENT_RESCHEDULED';

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  recipientPhone: string;
  patientName: string;
  tokenNumber: string;
  message: string;
  metadata?: Record<string, any>;
}

export async function dispatchWebhook(payload: WebhookPayload): Promise<void> {
  const webhookUrl = process.env.NOTIFICATION_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log(`\x1b[36m[WEBHOOK DISPATCHED: ${payload.event}]\x1b[0m`, payload);
    db.prepare(`
      INSERT INTO webhook_logs (event_type, payload, status_code, response_body)
      VALUES (?, ?, ?, ?)
    `).run(payload.event, JSON.stringify(payload), 200, 'LOGGED_LOCALLY');
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.WEBHOOK_SECRET_KEY || ''}`,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();

    db.prepare(`
      INSERT INTO webhook_logs (event_type, payload, status_code, response_body)
      VALUES (?, ?, ?, ?)
    `).run(payload.event, JSON.stringify(payload), response.status, responseText);
  } catch (error: any) {
    db.prepare(`
      INSERT INTO webhook_logs (event_type, payload, status_code, response_body)
      VALUES (?, ?, ?, ?)
    `).run(payload.event, JSON.stringify(payload), 500, error.message || 'Dispatch error');
  }
}