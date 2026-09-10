export type UserRole = 'CUSTOMER' | 'ADMIN' | null;
export type QueueStage = 'READY' | 'IN_PROGRESS' | 'COMPLETED' | 'BREAK';
export type CheckInStatus = 'NOT_CHECKED_IN' | 'CHECKED_IN';

export interface Doctor {
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
  queue_length?: number;
}

export interface Clinic {
  id: string;
  name: string;
  address: string;
  distance_km: number;
  mock_transit_minutes: number;
}

export interface PatientToken {
  id: string;
  token_number: string;
  clinic_id: string;
  doctor_id: string;
  patient_name: string;
  phone: string;
  is_emergency: number;
  check_in_status: CheckInStatus;
  queue_status: string;
  reschedule_count: number;
  position: number;
  mock_transit_duration_min: number;
  created_at: string;
}

export interface QueueResponse {
  clinic: Clinic;
  doctor: Doctor;
  queueState: {
    doctor_id: string;
    current_stage: QueueStage;
    break_duration_min: number;
  };
  activeQueue: PatientToken[];
}