import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Clinic, Doctor, PatientToken, QueueStage, UserRole, QueueResponse } from './type';

const API_BASE = 'http://localhost:5000/api';

export const ClinicQueueApp: React.FC = () => {
  const [currentRole, setCurrentRole] = useState<UserRole>(null);
  const [currentUserPhone, setCurrentUserPhone] = useState<string>('');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('doc-1');

  // Backend state
  const [doctorsList, setDoctorsList] = useState<Doctor[]>([]);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [activeQueue, setActiveQueue] = useState<PatientToken[]>([]);
  const [currentStage, setCurrentStage] = useState<QueueStage>('READY');
  const [breakMinutesRemaining, setBreakMinutesRemaining] = useState<number>(0);

  // Form Inputs
  const [custName, setCustName] = useState('Alex Johnson');
  const [custPhone, setCustPhone] = useState('9988776655');
  const [walkinName, setWalkinName] = useState('');
  const [walkinPhone, setWalkinPhone] = useState('');
  const [emergencyAlert, setEmergencyAlert] = useState<string | null>(null);

  // 1. Fetch all doctors with live queue lengths
  const fetchDoctors = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/doctors`);
      if (res.ok) {
        const data: Doctor[] = await res.json();
        setDoctorsList(data);
      }
    } catch (e) {
      console.error('Failed to load doctors list:', e);
    }
  }, []);

  // 2. Fetch queue state for active doctor
  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/queue?doctorId=${selectedDoctorId}`);
      if (!res.ok) return;
      const data: QueueResponse = await res.json();
      setClinic(data.clinic);
      setDoctor(data.doctor);
      setActiveQueue(data.activeQueue || []);
      if (data.queueState) {
        setCurrentStage(data.queueState.current_stage);
        setBreakMinutesRemaining(data.queueState.break_duration_min);
      }
    } catch (err) {
      console.error('Failed to sync queue:', err);
    }
  }, [selectedDoctorId]);

  useEffect(() => {
    fetchDoctors();
    fetchQueue();
    const interval = setInterval(() => {
      fetchDoctors();
      fetchQueue();
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchDoctors, fetchQueue]);

  // Turn calculation for customer
  const customerToken = useMemo(() => {
    return activeQueue.find((t) => t.phone === currentUserPhone);
  }, [activeQueue, currentUserPhone]);

  const customerPeopleAhead = useMemo(() => {
    if (!customerToken) return -1;
    return activeQueue.findIndex((t) => t.id === customerToken.id);
  }, [activeQueue, customerToken]);

  const calculateLeaveBy = (peopleAhead: number, transitMins: number) => {
    const buffer = 10;
    const avg = doctor?.avg_consult_min || 10;
    const stdDev = doctor?.std_dev_min || 3;
    const totalWaitTimeMinutes = peopleAhead * (avg + stdDev) + breakMinutesRemaining;

    const now = new Date();
    const departureDate = new Date(now.getTime() + (totalWaitTimeMinutes - transitMins - buffer) * 60000);

    return {
      waitMinutes: Math.max(0, totalWaitTimeMinutes),
      leaveByString: departureDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isDepartNow: totalWaitTimeMinutes <= transitMins + buffer,
    };
  };

  // Actions
  const handleBookToken = async (isWalkIn = false) => {
    if (!clinic || !doctor) return;
    const name = isWalkIn ? walkinName : custName;
    const phone = isWalkIn ? walkinPhone : custPhone;

    if (!name && !phone) {
      alert('Please provide a name or phone number.');
      return;
    }

    const res = await fetch(`${API_BASE}/queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clinicId: clinic.id,
        doctorId: doctor.id,
        patientName: name,
        phone: phone,
        isWalkIn,
      }),
    });

    if (res.ok) {
      if (!isWalkIn) setCurrentUserPhone(phone);
      setWalkinName('');
      setWalkinPhone('');
      await fetchQueue();
      await fetchDoctors();
    }
  };

  const handleControlAction = async (payload: Record<string, any>) => {
    if (!doctor) return;
    const res = await fetch(`${API_BASE}/queue/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doctorId: doctor.id, ...payload }),
    });
    if (res.ok) {
      await fetchQueue();
      await fetchDoctors();
    }
  };

  const handlePromoteToEmergency = async (item: PatientToken) => {
    const confirm = window.confirm(
      `Escalate Token ${item.token_number} (${item.patient_name}) to EMERGENCY priority?\nThis will bump them to the front of the queue.`
    );
    if (!confirm) return;

    await handleControlAction({
      action: 'PROMOTE_TO_EMERGENCY',
      tokenId: item.id,
    });
    setEmergencyAlert(`🚨 ${item.patient_name} (${item.token_number}) escalated to EMERGENCY priority.`);
    setTimeout(() => setEmergencyAlert(null), 6000);
  };

  const handleReschedule = async () => {
    if (!customerToken) return;
    const res = await fetch(`${API_BASE}/queue/reschedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokenId: customerToken.id }),
    });

    if (res.ok) {
      await fetchQueue();
    } else {
      const err = await res.json();
      alert(err.error || 'Reschedule failed');
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div>
          <h2 style={{ margin: 0 }}>Clinic Queue System</h2>
          <small style={{ color: '#64748b' }}>
            {clinic ? `${clinic.name} • ${clinic.address}` : 'Connecting...'}
          </small>
        </div>
        <div style={styles.roleBar}>
          <button
            style={currentRole === 'CUSTOMER' ? styles.activeTab : styles.tab}
            onClick={() => setCurrentRole('CUSTOMER')}
          >
            Customer View
          </button>
          <button
            style={currentRole === 'ADMIN' ? styles.activeTab : styles.tab}
            onClick={() => setCurrentRole('ADMIN')}
          >
            Clinic Admin View
          </button>
          {currentRole && (
            <button style={styles.logoutBtn} onClick={() => setCurrentRole(null)}>
              Exit Portal
            </button>
          )}
        </div>
      </header>

      {emergencyAlert && <div style={styles.emergencyBanner}>{emergencyAlert}</div>}

      {/* Role Selection Screen */}
      {!currentRole && (
        <div style={styles.landingGrid}>
          <div style={styles.card}>
            <h3>Customer Portal</h3>
            <p>Browse physicians, compare wait times and consultation fees, and reserve your turn.</p>
            <button style={styles.primaryBtn} onClick={() => setCurrentRole('CUSTOMER')}>
              Log In as Customer
            </button>
          </div>
          <div style={styles.card}>
            <h3>Clinic Admin Portal</h3>
            <p>Select any on-duty doctor, validate check-ins, advance the queue, or escalate emergency cases.</p>
            <button style={styles.secondaryBtn} onClick={() => setCurrentRole('ADMIN')}>
              Log In as Clinic Staff
            </button>
          </div>
        </div>
      )}

      {/* CUSTOMER PORTAL */}
      {currentRole === 'CUSTOMER' && (
        <div style={styles.portalContent}>
          {!customerToken ? (
            <div>
              {/* Doctor Selection Deck */}
              <h3 style={{ marginBottom: 12 }}>1. Select a Doctor</h3>
              <div style={styles.doctorGrid}>
                {doctorsList.map((doc) => {
                  const isSelected = doc.id === selectedDoctorId;
                  return (
                    <div
                      key={doc.id}
                      onClick={() => setSelectedDoctorId(doc.id)}
                      style={{
                        ...styles.doctorCard,
                        borderColor: isSelected ? '#2563eb' : '#e2e8f0',
                        backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <h4 style={{ margin: '0 0 4px 0' }}>{doc.name}</h4>
                          <span style={styles.specialtyBadge}>{doc.specialty}</span>
                        </div>
                        <span style={styles.priceTag}>${doc.token_price}</span>
                      </div>

                      <p style={{ margin: '8px 0', fontSize: '12px', color: '#475569' }}>
                        {doc.qualifications} • {doc.experience}
                      </p>
                      <small style={{ color: '#64748b', display: 'block', marginBottom: 10 }}>
                        🗓️ {doc.schedule}
                      </small>

                      <div style={styles.badgeRow}>
                        <span style={styles.statPill}>
                          👥 <strong>{doc.queue_length ?? 0}</strong> in queue
                        </span>
                        <span style={styles.statPill}>
                          ⏱️ ~{doc.avg_consult_min} min/pt
                        </span>
                      </div>

                      <button
                        style={{
                          ...styles.selectBtn,
                          backgroundColor: isSelected ? '#2563eb' : '#f1f5f9',
                          color: isSelected ? '#ffffff' : '#1e293b',
                        }}
                      >
                        {isSelected ? '✓ Selected' : 'Choose Doctor'}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Booking Confirmation Box */}
              <div style={{ ...styles.card, marginTop: 20 }}>
                <h3>2. Reserve Token for {doctor?.name}</h3>
                <div style={styles.formRow}>
                  <input
                    placeholder="Your Full Name"
                    style={styles.input}
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                  />
                  <input
                    placeholder="Phone Number"
                    style={styles.input}
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                  />
                </div>

                <div style={styles.feeBreakdown}>
                  <span>Token Amount: <strong>${doctor?.token_price}.00 (Mock Transaction)</strong></span>
                  <small style={{ color: '#64748b', display: 'block' }}>
                    Refundable if clinic overbooks or appointment is cancelled.
                  </small>
                </div>

                <button style={styles.primaryBtn} onClick={() => handleBookToken(false)}>
                  Confirm & Book Appointment Token
                </button>
              </div>
            </div>
          ) : (
            /* Active Turn Card */
            <div style={styles.activeTokenGrid}>
              <div style={styles.card}>
                <div style={styles.tokenHeader}>
                  <div>
                    <h4 style={{ margin: 0 }}>Your Appointment Token</h4>
                    <small>{doctor?.name} ({doctor?.specialty})</small>
                  </div>
                  <span style={styles.tokenTag}>{customerToken.token_number}</span>
                </div>

                <div style={styles.statBox}>
                  {customerPeopleAhead === 0 ? (
                    <h2 style={{ color: '#16a34a', margin: '8px 0' }}>NOW SERVING</h2>
                  ) : (
                    <div>
                      <span style={{ fontSize: '38px', fontWeight: 800 }}>{customerPeopleAhead}</span>
                      <span style={{ display: 'block', color: '#64748b' }}>Patients Ahead of You</span>
                    </div>
                  )}
                </div>

                <div style={styles.actionRow}>
                  <button
                    style={styles.outlineBtn}
                    onClick={handleReschedule}
                    disabled={customerToken.reschedule_count >= 1}
                  >
                    {customerToken.reschedule_count >= 1 ? 'Reschedule Used (Max 1)' : 'Reschedule for Later Today'}
                  </button>
                </div>
              </div>

              <div style={styles.card}>
                <h3>Route & Departure Advisory</h3>
                <div style={styles.mapSimulator}>
                  <div>📍 Destination: {clinic?.address}</div>
                  <small>Distance: {clinic?.distance_km} km • Estimated Transit: {customerToken.mock_transit_duration_min} mins</small>
                </div>

                <div style={{ margin: '14px 0' }}>
                  {customerToken.check_in_status === 'CHECKED_IN' ? (
                    <span style={styles.arrivedBadge}>✓ Arrived & Checked In at Clinic</span>
                  ) : (
                    <span style={styles.enRouteBadge}>⏳ In Transit / Not Checked In</span>
                  )}
                </div>

                {(() => {
                  const guidance = calculateLeaveBy(customerPeopleAhead, customerToken.mock_transit_duration_min);
                  return (
                    <div style={styles.timingCard}>
                      <div><strong>Estimated Wait:</strong> ~{guidance.waitMinutes} mins</div>
                      <div>
                        <strong>Recommended Departure: </strong>
                        <span style={{ color: guidance.isDepartNow ? '#dc2626' : '#2563eb' }}>
                          {guidance.isDepartNow ? 'Leave Immediately' : `Leave by ${guidance.leaveByString}`}
                        </span>
                      </div>
                      <small style={{ color: '#64748b', display: 'block', marginTop: '4px' }}>
                        Based on {doctor?.name}&apos;s average consultation time ({doctor?.avg_consult_min}m) + traffic buffer.
                      </small>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CLINIC ADMIN PORTAL */}
      {currentRole === 'ADMIN' && (
        <div style={styles.portalContent}>
          {/* Doctor Switcher for Admin */}
          <div style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <label style={{ fontWeight: 600, marginRight: 8 }}>Managing Doctor:</label>
                <select
                  style={styles.selectInput}
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                >
                  {doctorsList.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.specialty}) — {d.queue_length} in queue
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.buttonGroup}>
                <button
                  style={currentStage === 'READY' ? styles.activeStageBtn : styles.stageBtn}
                  onClick={() => handleControlAction({ action: 'SET_STAGE', stage: 'READY' })}
                >
                  Ready
                </button>
                <button
                  style={currentStage === 'IN_PROGRESS' ? styles.activeStageBtn : styles.stageBtn}
                  onClick={() => handleControlAction({ action: 'SET_STAGE', stage: 'IN_PROGRESS' })}
                >
                  In Progress
                </button>
                <button
                  style={styles.doneBtn}
                  onClick={() => handleControlAction({ action: 'COMPLETE_CURRENT' })}
                >
                  Completed (Next)
                </button>
                <button
                  style={styles.breakBtn}
                  onClick={() => handleControlAction({ action: 'SET_BREAK', breakDurationMin: 15 })}
                >
                  Break (15m)
                </button>
              </div>
            </div>
          </div>

          <div style={styles.adminGrid}>
            {/* Active Queue with Emergency Promotion */}
            <div style={styles.card}>
              <h4>Active Queue for {doctor?.name} ({activeQueue.length})</h4>
              {activeQueue.length === 0 ? (
                <p style={{ color: '#94a3b8' }}>No patients in this doctor&apos;s queue.</p>
              ) : (
                activeQueue.map((item, idx) => (
                  <div
                    key={item.id}
                    style={{
                      ...styles.queueItem,
                      borderLeft: item.is_emergency ? '5px solid #dc2626' : '1px solid #e2e8f0',
                      backgroundColor: item.is_emergency ? '#fff5f5' : '#ffffff',
                    }}
                  >
                    <div>
                      <strong>{item.token_number}</strong> — {item.patient_name}
                      {item.is_emergency === 1 && <span style={styles.emergencyTag}>EMERGENCY</span>}
                      <small style={{ display: 'block', color: '#64748b' }}>
                        Phone: {item.phone} • Added: {item.created_at}
                      </small>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {/* Check-In Toggle */}
                      <button
                        style={
                          item.check_in_status === 'CHECKED_IN'
                            ? styles.checkedInBtn
                            : styles.checkInToggleBtn
                        }
                        onClick={() => handleControlAction({ action: 'CHECK_IN', tokenId: item.id })}
                      >
                        {item.check_in_status === 'CHECKED_IN' ? '✓ Checked In' : 'Validate'}
                      </button>

                      {/* Escalate to Emergency Button */}
                      {item.is_emergency === 0 && (
                        <button
                          style={styles.escalateBtn}
                          onClick={() => handlePromoteToEmergency(item)}
                          title="Move patient to the front as an emergency"
                        >
                          🚨 Make Emergency
                        </button>
                      )}

                      <span style={styles.positionBadge}>{idx === 0 ? 'Serving' : `#${idx + 1}`}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Offline Desk Walk-in */}
            <div style={styles.card}>
              <h4>Register Walk-in for {doctor?.name}</h4>
              <p style={{ fontSize: '13px', color: '#64748b' }}>
                Walk-ins are added directly into {doctor?.name}&apos;s line and automatically marked as Checked In.
              </p>
              <input
                placeholder="Patient Name"
                style={styles.input}
                value={walkinName}
                onChange={(e) => setWalkinName(e.target.value)}
              />
              <input
                placeholder="Contact Phone"
                style={styles.input}
                value={walkinPhone}
                onChange={(e) => setWalkinPhone(e.target.value)}
              />
              <button style={styles.primaryBtn} onClick={() => handleBookToken(true)}>
                Insert Walk-in to Queue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Inline Styles
const styles: { [key: string]: React.CSSProperties } = {
  container: { maxWidth: 1100, margin: '20px auto', fontFamily: 'system-ui, sans-serif', color: '#1e293b' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  roleBar: { display: 'flex', gap: 8 },
  tab: { padding: '8px 14px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' },
  activeTab: { padding: '8px 14px', borderRadius: 6, border: '1px solid #2563eb', background: '#2563eb', color: '#fff', fontWeight: 600 },
  logoutBtn: { padding: '8px 12px', background: '#fee2e2', color: '#b91c1c', border: 0, borderRadius: 6, cursor: 'pointer' },
  landingGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 40 },
  portalContent: { display: 'flex', flexDirection: 'column', gap: 20 },
  card: { background: '#fff', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  doctorGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 },
  doctorCard: { padding: 14, borderRadius: 10, border: '2px solid', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' },
  specialtyBadge: { background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 },
  priceTag: { fontSize: 18, fontWeight: 800, color: '#16a34a' },
  badgeRow: { display: 'flex', gap: 6, margin: '8px 0' },
  statPill: { background: '#f8fafc', border: '1px solid #e2e8f0', padding: '3px 8px', borderRadius: 6, fontSize: 11, color: '#334155' },
  selectBtn: { width: '100%', padding: '8px', border: 0, borderRadius: 6, fontWeight: 700, cursor: 'pointer', marginTop: 8 },
  formRow: { display: 'flex', gap: 12, marginBottom: 12 },
  input: { flex: 1, padding: 10, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14, width: '100%', boxSizing: 'border-box', marginBottom: 8 },
  selectInput: { padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14 },
  feeBreakdown: { background: '#f8fafc', padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 13 },
  primaryBtn: { width: '100%', padding: '12px', background: '#2563eb', color: '#fff', border: 0, borderRadius: 6, fontWeight: 700, cursor: 'pointer' },
  secondaryBtn: { width: '100%', padding: '12px', background: '#0f172a', color: '#fff', border: 0, borderRadius: 6, fontWeight: 700, cursor: 'pointer' },
  emergencyBanner: { background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', padding: 12, borderRadius: 8, marginBottom: 16, fontWeight: 600 },
  tokenHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  tokenTag: { background: '#eff6ff', color: '#1d4ed8', padding: '6px 14px', borderRadius: 20, fontWeight: 800, fontSize: 18 },
  statBox: { textAlign: 'center', margin: '24px 0', background: '#f8fafc', padding: 20, borderRadius: 8 },
  actionRow: { display: 'flex', gap: 10, marginTop: 16 },
  outlineBtn: { flex: 1, padding: 10, background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer' },
  mapSimulator: { background: '#f8fafc', border: '1px dashed #cbd5e1', padding: 16, borderRadius: 8, margin: '12px 0' },
  timingCard: { background: '#f0fdf4', border: '1px solid #bbf7d0', padding: 14, borderRadius: 8 },
  arrivedBadge: { background: '#dcfce7', color: '#15803d', padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700 },
  enRouteBadge: { background: '#fef3c7', color: '#b45309', padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700 },
  activeTokenGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
  adminGrid: { display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 },
  buttonGroup: { display: 'flex', gap: 6 },
  stageBtn: { padding: '6px 12px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer' },
  activeStageBtn: { padding: '6px 12px', background: '#0284c7', color: '#fff', border: 0, borderRadius: 6, fontWeight: 700 },
  doneBtn: { padding: '6px 12px', background: '#16a34a', color: '#fff', border: 0, borderRadius: 6, fontWeight: 700, cursor: 'pointer' },
  breakBtn: { padding: '6px 12px', background: '#d97706', color: '#fff', border: 0, borderRadius: 6, fontWeight: 700, cursor: 'pointer' },
  queueItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottom: '1px solid #f1f5f9' },
  positionBadge: { background: '#f1f5f9', padding: '4px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700 },
  checkInToggleBtn: { padding: '5px 8px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 11, cursor: 'pointer' },
  checkedInBtn: { padding: '5px 8px', background: '#dcfce7', border: '1px solid #86efac', color: '#166534', borderRadius: 6, fontSize: 11, fontWeight: 700 },
  escalateBtn: { padding: '5px 8px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' },
  emergencyTag: { background: '#fee2e2', color: '#b91c1c', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 800, marginLeft: 6 },
};