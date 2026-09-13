import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Clinic, Doctor, PatientToken, QueueStage, QueueResponse, User } from './type';
import { AuthModal } from './components/AuthModal';

const API_BASE = 'http://localhost:5000/api';

const DEPARTMENTS = [
  'All',
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

export const ClinicQueueApp: React.FC = () => {
  // Navigation & Role
  const [activeTab, setActiveTab] = useState<'DISCOVER' | 'PROFILE'>('DISCOVER');
  const [isStaffMode, setIsStaffMode] = useState<boolean>(false);

  // Authentication
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(() => localStorage.getItem('clinic_auth_token'));
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  // User appointment history
  const [userBookings, setUserBookings] = useState<PatientToken[]>([]);

  // Search, Filters & Sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [maxPrice, setMaxPrice] = useState<number>(100);
  const [maxDistance, setMaxDistance] = useState<number>(25);
  const [sortBy, setSortBy] = useState<'distance' | 'rating' | 'price_asc' | 'price_desc'>('distance');

  // Backend Live State
  const [doctorsList, setDoctorsList] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('doc-1');
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [activeQueue, setActiveQueue] = useState<PatientToken[]>([]);
  const [currentStage, setCurrentStage] = useState<QueueStage>('READY');
  const [breakMinutesRemaining, setBreakMinutesRemaining] = useState<number>(0);

  // Booking Modal / Drawer state
  const [bookingDoctor, setBookingDoctor] = useState<Doctor | null>(null);
  const [bookPatientName, setBookPatientName] = useState('');
  const [isBookingSubmitting, setIsBookingSubmitting] = useState(false);

  // Admin Walk-in Inputs
  const [walkinName, setWalkinName] = useState('');
  const [walkinPhone, setWalkinPhone] = useState('');

  // 1. Fetch filtered doctors list
  const fetchDoctors = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (selectedDept && selectedDept !== 'All') params.append('department', selectedDept);
      if (maxPrice < 100) params.append('maxPrice', String(maxPrice));
      if (maxDistance < 25) params.append('maxDistance', String(maxDistance));
      if (sortBy) params.append('sortBy', sortBy);

      const res = await fetch(`${API_BASE}/doctors?${params.toString()}`);
      if (res.ok) {
        const data: Doctor[] = await res.json();
        setDoctorsList(data);
      }
    } catch (e) {
      console.error('Failed to load doctors:', e);
    }
  }, [searchTerm, selectedDept, maxPrice, maxDistance, sortBy]);

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

  // 3. Fetch user appointments
  const fetchUserBookings = useCallback(async () => {
    if (!authToken) return;
    try {
      const res = await fetch(`${API_BASE}/user/tokens`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data: PatientToken[] = await res.json();
        setUserBookings(data);
      }
    } catch (e) {
      console.error('Failed to fetch user bookings:', e);
    }
  }, [authToken]);

  // Restore session
  useEffect(() => {
    if (authToken) {
      fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error('Invalid session');
        })
        .then((data) => {
          if (data.user) {
            setCurrentUser(data.user);
            setEditName(data.user.full_name);
            setEditEmail(data.user.email);
            setBookPatientName(data.user.full_name);
          }
        })
        .catch(() => {
          localStorage.removeItem('clinic_auth_token');
          setAuthToken(null);
          setCurrentUser(null);
        });
    }
  }, [authToken]);

  // Periodic polling for real-time queue sync
  useEffect(() => {
    fetchDoctors();
    fetchQueue();
    if (authToken) fetchUserBookings();

    const interval = setInterval(() => {
      fetchQueue();
      fetchDoctors();
      if (authToken) fetchUserBookings();
    }, 4000);
    return () => clearInterval(interval);
  }, [fetchDoctors, fetchQueue, fetchUserBookings, authToken]);

  // Turn calculation for logged-in user or current phone
  const userActiveToken = useMemo(() => {
    if (userBookings.length > 0) {
      const active = userBookings.find((t) => t.queue_status === 'WAITING' || t.queue_status === 'SERVING');
      if (active) return active;
    }
    if (currentUser?.phone) {
      return activeQueue.find((t) => t.phone === currentUser.phone);
    }
    return null;
  }, [userBookings, activeQueue, currentUser]);

  const peopleAheadCount = useMemo(() => {
    if (!userActiveToken) return -1;
    const idx = activeQueue.findIndex((t) => t.id === userActiveToken.id);
    return idx >= 0 ? idx : userActiveToken.position - 1;
  }, [activeQueue, userActiveToken]);

  const calculateLeaveBy = (peopleAhead: number, transitMins: number) => {
    const buffer = 10;
    const avg = doctor?.avg_consult_min || 12;
    const stdDev = doctor?.std_dev_min || 3;
    const waitMins = Math.max(0, peopleAhead * (avg + stdDev) + breakMinutesRemaining);
    const departureDate = new Date(Date.now() + (waitMins - transitMins - buffer) * 60000);

    return {
      waitMinutes: waitMins,
      leaveByString: departureDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isDepartNow: waitMins <= transitMins + buffer,
    };
  };

  // Profile Save
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken || !editName.trim() || !editEmail.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ fullName: editName.trim(), email: editEmail.trim() }),
      });

      const data = await res.json();
      if (res.ok && data.user) {
        setCurrentUser(data.user);
        if (data.token) {
          setAuthToken(data.token);
          localStorage.setItem('clinic_auth_token', data.token);
        }
        setIsEditingProfile(false);
        setProfileMessage('✓ Profile updated successfully.');
        setTimeout(() => setProfileMessage(null), 4000);
      } else {
        alert(data.error || 'Failed to update profile');
      }
    } catch {
      alert('Error saving profile changes');
    }
  };

  // Auth Callbacks
  const handleAuthSuccess = (user: User, token: string) => {
    setCurrentUser(user);
    setAuthToken(token);
    localStorage.setItem('clinic_auth_token', token);
    setEditName(user.full_name);
    setEditEmail(user.email);
    setBookPatientName(user.full_name);
    fetchUserBookings();
  };

  const handleLogout = () => {
    localStorage.removeItem('clinic_auth_token');
    setAuthToken(null);
    setCurrentUser(null);
    setUserBookings([]);
    setActiveTab('DISCOVER');
  };

  // Token Booking
  const handleConfirmBooking = async () => {
    if (!bookingDoctor) return;
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }

    setIsBookingSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicId: bookingDoctor.clinic_id,
          doctorId: bookingDoctor.id,
          patientName: bookPatientName.trim() || currentUser.full_name,
          phone: currentUser.phone,
          isWalkIn: false,
          userId: currentUser.id,
        }),
      });

      if (res.ok) {
        setSelectedDoctorId(bookingDoctor.id);
        setBookingDoctor(null);
        await fetchQueue();
        await fetchDoctors();
        await fetchUserBookings();
      } else {
        const err = await res.json();
        alert(err.error || 'Booking failed');
      }
    } catch {
      alert('Network error while booking token.');
    } finally {
      setIsBookingSubmitting(false);
    }
  };

  // Staff Actions
  const handleStaffControl = async (payload: Record<string, any>) => {
    if (!selectedDoctorId) return;
    const res = await fetch(`${API_BASE}/queue/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doctorId: selectedDoctorId, ...payload }),
    });
    if (res.ok) {
      await fetchQueue();
      await fetchDoctors();
    }
  };

  const handleStaffWalkin = async () => {
    if (!walkinName && !walkinPhone) return;
    await fetch(`${API_BASE}/queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clinicId: clinic?.id || 'clinic-1',
        doctorId: selectedDoctorId,
        patientName: walkinName || 'Walk-in Patient',
        phone: walkinPhone || 'N/A',
        isWalkIn: true,
      }),
    });
    setWalkinName('');
    setWalkinPhone('');
    await fetchQueue();
    await fetchDoctors();
  };

  const handleReschedule = async (tokenId: string) => {
    const res = await fetch(`${API_BASE}/queue/reschedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokenId }),
    });
    if (res.ok) {
      await fetchQueue();
      await fetchUserBookings();
    } else {
      const err = await res.json();
      alert(err.error || 'Reschedule limit reached (max 1 allowed)');
    }
  };

  return (
    <div style={hStyles.canvas}>
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
        apiBase={API_BASE}
      />

      {/* Main Container */}
      <div style={hStyles.wrapper}>
        {/* Top Editorial Header */}
        <header style={hStyles.header}>
          <div>
            <span style={hStyles.brandKicker}>CLINICAL CONCIERGE</span>
            <h1 style={hStyles.brandTitle}>ClinicQueue</h1>
          </div>

          <div style={hStyles.headerActions}>
            {/* Staff mode toggle pill */}
            <button
              style={isStaffMode ? hStyles.staffBtnActive : hStyles.staffBtn}
              onClick={() => setIsStaffMode(!isStaffMode)}
            >
              {isStaffMode ? '✓ Staff Mode On' : 'Clinic Staff Mode'}
            </button>

            {/* Auth Pill */}
            {currentUser ? (
              <div
                style={hStyles.profilePill}
                onClick={() => {
                  setActiveTab('PROFILE');
                  setIsStaffMode(false);
                }}
              >
                <div style={hStyles.avatarCircle}>{currentUser.full_name.charAt(0).toUpperCase()}</div>
                <span style={{ fontWeight: 600 }}>{currentUser.full_name}</span>
              </div>
            ) : (
              <button style={hStyles.signInPill} onClick={() => setIsAuthModalOpen(true)}>
                Sign In
              </button>
            )}
          </div>
        </header>

        {/* Navigation Tabs (Hinge Style) */}
        {!isStaffMode && (
          <nav style={hStyles.tabNav}>
            <button
              style={activeTab === 'DISCOVER' ? hStyles.activeNavTab : hStyles.navTab}
              onClick={() => setActiveTab('DISCOVER')}
            >
              Explore & Book Doctors
            </button>
            <button
              style={activeTab === 'PROFILE' ? hStyles.activeNavTab : hStyles.navTab}
              onClick={() => {
                if (!currentUser) {
                  setIsAuthModalOpen(true);
                } else {
                  setActiveTab('PROFILE');
                }
              }}
            >
              My Profile & Visits {userBookings.length > 0 && `(${userBookings.length})`}
            </button>
          </nav>
        )}

        {/* STAFF / ADMIN VIEW */}
        {isStaffMode && (
          <div style={hStyles.adminCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontFamily: 'Georgia, serif' }}>Clinic Reception Desk</h3>
                <small style={{ color: '#78716C' }}>Manage live queue, call next patient, or register walk-ins</small>
              </div>
              <button style={hStyles.outlineSmallBtn} onClick={() => setIsStaffMode(false)}>
                ← Back to Patient View
              </button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={hStyles.fieldLabel}>Select On-Duty Doctor to Manage (100 Available):</label>
              <select
                style={hStyles.select}
                value={selectedDoctorId}
                onChange={(e) => setSelectedDoctorId(e.target.value)}
              >
                {doctorsList.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} — {d.specialty} ({d.clinic_name} • {d.queue_length ?? 0} in queue)
                  </option>
                ))}
              </select>
            </div>

            {/* Stage buttons */}
            <div style={hStyles.adminButtonGroup}>
              <button
                style={currentStage === 'READY' ? hStyles.stageActiveBtn : hStyles.stageBtn}
                onClick={() => handleStaffControl({ action: 'SET_STAGE', stage: 'READY' })}
              >
                Ready
              </button>
              <button
                style={currentStage === 'IN_PROGRESS' ? hStyles.stageActiveBtn : hStyles.stageBtn}
                onClick={() => handleStaffControl({ action: 'SET_STAGE', stage: 'IN_PROGRESS' })}
              >
                In Progress
              </button>
              <button
                style={hStyles.completeBtn}
                onClick={() => handleStaffControl({ action: 'COMPLETE_CURRENT' })}
              >
                ✓ Complete Current & Call Next
              </button>
              <button
                style={hStyles.breakBtn}
                onClick={() => handleStaffControl({ action: 'SET_BREAK', breakDurationMin: 15 })}
              >
                ☕ 15m Break
              </button>
            </div>

            <div style={hStyles.adminColumns}>
              {/* Active list */}
              <div>
                <h4 style={{ margin: '12px 0 8px 0' }}>Live Waiting List ({activeQueue.length})</h4>
                {activeQueue.length === 0 ? (
                  <p style={{ color: '#A8A29E', fontSize: '13px' }}>Queue is currently empty.</p>
                ) : (
                  activeQueue.map((item, idx) => (
                    <div key={item.id} style={hStyles.adminQueueRow}>
                      <div>
                        <strong>{item.token_number}</strong> — {item.patient_name}
                        {item.is_emergency === 1 && <span style={hStyles.emergencyBadge}>EMERGENCY</span>}
                        <div style={{ fontSize: '12px', color: '#78716C' }}>Phone: {item.phone}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button
                          style={item.check_in_status === 'CHECKED_IN' ? hStyles.checkedInPill : hStyles.checkInPill}
                          onClick={() => handleStaffControl({ action: 'CHECK_IN', tokenId: item.id })}
                        >
                          {item.check_in_status === 'CHECKED_IN' ? '✓ Checked In' : 'Validate'}
                        </button>
                        <span style={hStyles.posTag}>{idx === 0 ? 'Serving' : `#${idx + 1}`}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Walkin Register */}
              <div style={hStyles.walkinBox}>
                <h4 style={{ margin: '0 0 8px 0' }}>Register Walk-in Patient</h4>
                <input
                  style={hStyles.input}
                  placeholder="Patient Full Name"
                  value={walkinName}
                  onChange={(e) => setWalkinName(e.target.value)}
                />
                <input
                  style={hStyles.input}
                  placeholder="Contact Phone"
                  value={walkinPhone}
                  onChange={(e) => setWalkinPhone(e.target.value)}
                />
                <button style={hStyles.primaryHingeBtn} onClick={handleStaffWalkin}>
                  Add Walk-in to Front Desk
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: DISCOVER & BOOK */}
        {!isStaffMode && activeTab === 'DISCOVER' && (
          <div>
            {/* Live Active Token Floating Card */}
            {userActiveToken && (
              <div style={hStyles.liveTurnCard}>
                <div style={hStyles.liveTurnHeader}>
                  <div>
                    <span style={hStyles.liveTurnTag}>ACTIVE APPOINTMENT</span>
                    <h3 style={{ margin: '4px 0 0 0', fontFamily: 'Georgia, serif' }}>
                      {userActiveToken.doctor_name || doctor?.name}
                    </h3>
                    <small style={{ color: '#78716C' }}>
                      {userActiveToken.clinic_name || clinic?.name} • Token #{userActiveToken.token_number}
                    </small>
                  </div>
                  <div style={hStyles.turnBigNumber}>
                    {peopleAheadCount <= 0 ? (
                      <span style={{ color: '#16A34A' }}>NOW SERVING</span>
                    ) : (
                      <>
                        <strong>{peopleAheadCount}</strong>
                        <small>Ahead</small>
                      </>
                    )}
                  </div>
                </div>

                {/* Departure Advisory */}
                {(() => {
                  const advisory = calculateLeaveBy(peopleAheadCount, userActiveToken.mock_transit_duration_min || 14);
                  return (
                    <div style={hStyles.advisoryStrip}>
                      <div>
                        <strong>Wait Time:</strong> ~{advisory.waitMinutes} mins • <strong>Transit:</strong> ~{userActiveToken.mock_transit_duration_min || 14} mins
                      </div>
                      <div style={{ color: advisory.isDepartNow ? '#DC2626' : '#7A2036', fontWeight: 700 }}>
                        {advisory.isDepartNow ? '🚨 Recommended: Depart Immediately' : `Recommended: Leave by ${advisory.leaveByString}`}
                      </div>
                    </div>
                  );
                })()}

                <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button
                    style={hStyles.outlineSmallBtn}
                    onClick={() => handleReschedule(userActiveToken.id)}
                    disabled={userActiveToken.reschedule_count >= 1}
                  >
                    {userActiveToken.reschedule_count >= 1 ? 'Rescheduled (Max 1)' : 'Reschedule for Later'}
                  </button>
                </div>
              </div>
            )}

            {/* Editorial Search Bar */}
            <div style={hStyles.searchSection}>
              <div style={hStyles.searchBarContainer}>
                <span style={hStyles.searchIcon}>🔍</span>
                <input
                  style={hStyles.searchInput}
                  placeholder="Search department, doctor name, hospital or neighborhood..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button style={hStyles.clearBtn} onClick={() => setSearchTerm('')}>
                    ✕
                  </button>
                )}
              </div>

              {/* Department Scrollable Chips */}
              <div style={hStyles.chipScroller}>
                {DEPARTMENTS.map((dept) => {
                  const isSelected = selectedDept === dept;
                  return (
                    <button
                      key={dept}
                      style={isSelected ? hStyles.activeChip : hStyles.chip}
                      onClick={() => setSelectedDept(dept)}
                    >
                      {dept}
                    </button>
                  );
                })}
              </div>

              {/* Filter & Sort Drawer Toolbar */}
              <div style={hStyles.filterBar}>
                {/* Price Slider */}
                <div style={hStyles.filterControl}>
                  <div style={hStyles.filterLabelRow}>
                    <span style={hStyles.filterLabel}>Max Consultation Fee:</span>
                    <strong>${maxPrice}</strong>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={100}
                    step={5}
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(Number(e.target.value))}
                    style={hStyles.slider}
                  />
                </div>

                {/* Distance Slider */}
                <div style={hStyles.filterControl}>
                  <div style={hStyles.filterLabelRow}>
                    <span style={hStyles.filterLabel}>Max Distance Radius:</span>
                    <strong>{maxDistance} km</strong>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={25}
                    step={1}
                    value={maxDistance}
                    onChange={(e) => setMaxDistance(Number(e.target.value))}
                    style={hStyles.slider}
                  />
                </div>

                {/* Sort Option */}
                <div style={hStyles.filterControl}>
                  <span style={hStyles.filterLabel}>Sort By:</span>
                  <select
                    style={hStyles.sortSelect}
                    value={sortBy}
                    onChange={(e: any) => setSortBy(e.target.value)}
                  >
                    <option value="distance">📍 Distance (Nearest First)</option>
                    <option value="rating">★ Highest Rated</option>
                    <option value="price_asc">💵 Price: Low to High</option>
                    <option value="price_desc">💎 Price: High to Low</option>
                  </select>
                </div>
              </div>

              {/* Results summary */}
              <div style={hStyles.resultsBar}>
                <span>
                  Showing <strong>{doctorsList.length}</strong> available physicians
                  {selectedDept !== 'All' && ` in ${selectedDept}`}
                </span>
                {(searchTerm || selectedDept !== 'All' || maxPrice < 100 || maxDistance < 25) && (
                  <button
                    style={hStyles.resetFiltersBtn}
                    onClick={() => {
                      setSearchTerm('');
                      setSelectedDept('All');
                      setMaxPrice(100);
                      setMaxDistance(25);
                      setSortBy('distance');
                    }}
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            </div>

            {/* Doctors Grid (Hinge-Style Profile Cards) */}
            <div style={hStyles.doctorGrid}>
              {doctorsList.map((doc) => (
                <div key={doc.id} style={hStyles.doctorHingeCard}>
                  {/* Card Header */}
                  <div style={hStyles.docCardTop}>
                    <div>
                      <span style={hStyles.deptBadge}>{doc.specialty}</span>
                      <h3 style={hStyles.docName}>{doc.name}</h3>
                      <p style={hStyles.docQual}>{doc.qualifications} • {doc.experience}</p>
                    </div>
                    <div style={hStyles.ratingPill}>
                      ★ {(doc.rating ?? 4.8).toFixed(1)} <small>({doc.review_count ?? 85})</small>
                    </div>
                  </div>

                  {/* Clinic Details Prompt */}
                  <div style={hStyles.promptBox}>
                    <div style={{ fontWeight: 600, color: '#1C1917' }}>🏥 {doc.clinic_name}</div>
                    <div style={{ fontSize: '12px', color: '#78716C', marginTop: 2 }}>
                      {doc.neighborhood} • {doc.distance_km} km away (~{doc.mock_transit_minutes}m drive)
                    </div>
                  </div>

                  {/* Timing & Consultation Stats */}
                  <div style={hStyles.metaRow}>
                    <div style={hStyles.metaPill}>
                      <span>🗓️</span> {doc.schedule}
                    </div>
                    <div style={hStyles.metaPill}>
                      <span>👥</span> <strong>{doc.queue_length ?? 0}</strong> waiting
                    </div>
                    <div style={hStyles.metaPill}>
                      <span>⏱️</span> ~{doc.avg_consult_min} min/pt
                    </div>
                  </div>

                  {/* Card Footer with Price & CTA */}
                  <div style={hStyles.docCardFooter}>
                    <div>
                      <span style={{ fontSize: '11px', color: '#78716C', display: 'block' }}>CONSULTATION</span>
                      <span style={hStyles.priceText}>${doc.token_price}</span>
                    </div>
                    <button
                      style={hStyles.bookBtn}
                      onClick={() => {
                        setBookingDoctor(doc);
                        setBookPatientName(currentUser?.full_name || '');
                      }}
                    >
                      Book Turn →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: USER PROFILE & HISTORY */}
        {!isStaffMode && activeTab === 'PROFILE' && (
          <div style={hStyles.profileContainer}>
            {/* User Details Card */}
            <div style={hStyles.profileCard}>
              <div style={hStyles.profileHeaderRow}>
                <div style={hStyles.avatarBig}>
                  {currentUser?.full_name.charAt(0).toUpperCase() || 'U'}
                </div>
                <div>
                  <h2 style={{ margin: '0 0 4px 0', fontFamily: 'Georgia, serif' }}>{currentUser?.full_name}</h2>
                  <div style={{ color: '#78716C', fontSize: '14px' }}>
                    📱 {currentUser?.phone} <span style={hStyles.verifiedTag}>✓ Verified</span>
                  </div>
                  <div style={{ color: '#78716C', fontSize: '13px' }}>✉️ {currentUser?.email}</div>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  <button
                    style={isEditingProfile ? hStyles.outlineSmallBtnActive : hStyles.outlineSmallBtn}
                    onClick={() => setIsEditingProfile(!isEditingProfile)}
                  >
                    {isEditingProfile ? 'Cancel Edit' : 'Edit Profile'}
                  </button>
                </div>
              </div>

              {profileMessage && <div style={hStyles.successAlert}>{profileMessage}</div>}

              {/* Edit Form */}
              {isEditingProfile && (
                <form onSubmit={handleSaveProfile} style={hStyles.editForm}>
                  <div>
                    <label style={hStyles.fieldLabel}>Full Name</label>
                    <input
                      style={hStyles.input}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label style={hStyles.fieldLabel}>Email Address</label>
                    <input
                      style={hStyles.input}
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label style={hStyles.fieldLabel}>Phone Number</label>
                    <input style={hStyles.inputDisabled} value={currentUser?.phone || ''} disabled />
                    <small style={{ color: '#78716C', fontSize: '11px' }}>
                      Phone number is verified and tied to OTP authentication.
                    </small>
                  </div>
                  <button type="submit" style={hStyles.primaryHingeBtn}>
                    Save Changes
                  </button>
                </form>
              )}

              <div style={{ marginTop: 24, borderTop: '1px solid #EFECE6', paddingTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                <button style={hStyles.logoutHingeBtn} onClick={handleLogout}>
                  Log Out
                </button>
              </div>
            </div>

            {/* Visit History & Active Tokens */}
            <div style={hStyles.historySection}>
              <h3 style={{ fontFamily: 'Georgia, serif', marginBottom: 14 }}>My Appointments & Queue History</h3>
              {userBookings.length === 0 ? (
                <div style={hStyles.emptyState}>
                  <p style={{ margin: 0, color: '#78716C' }}>You have no appointment records yet.</p>
                  <button style={hStyles.exploreLink} onClick={() => setActiveTab('DISCOVER')}>
                    Explore doctors to book your first token →
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {userBookings.map((b) => {
                    const isCompleted = b.queue_status === 'COMPLETED';
                    return (
                      <div key={b.id} style={hStyles.bookingHistoryCard}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={hStyles.tokenBadge}>{b.token_number}</span>
                            <h4 style={{ margin: 0 }}>{b.doctor_name}</h4>
                            <span style={hStyles.deptBadgeSmall}>{b.doctor_specialty}</span>
                          </div>
                          <div style={{ fontSize: '13px', color: '#78716C', marginTop: 4 }}>
                            🏥 {b.clinic_name} • {b.clinic_address}
                          </div>
                          <div style={{ fontSize: '12px', color: '#A8A29E', marginTop: 2 }}>
                            Booked on: {new Date(b.created_at).toLocaleDateString()} at {new Date(b.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <span style={isCompleted ? hStyles.statusCompleted : hStyles.statusActive}>
                            {isCompleted ? '✓ Completed' : 'In Queue'}
                          </span>
                          {!isCompleted && (
                            <div style={{ fontSize: '12px', color: '#7A2036', fontWeight: 600, marginTop: 4 }}>
                              Position #{b.position}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 1-Click Booking Confirmation Modal */}
        {bookingDoctor && (
          <div style={hStyles.modalOverlay}>
            <div style={hStyles.bookingModalCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <span style={hStyles.deptBadge}>{bookingDoctor.specialty}</span>
                  <h3 style={{ margin: '4px 0', fontFamily: 'Georgia, serif' }}>{bookingDoctor.name}</h3>
                  <small style={{ color: '#78716C' }}>{bookingDoctor.clinic_name} ({bookingDoctor.neighborhood})</small>
                </div>
                <button style={hStyles.modalClose} onClick={() => setBookingDoctor(null)}>✕</button>
              </div>

              <div style={hStyles.promptBox}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: '#78716C' }}>Consultation Fee:</span>
                  <strong>${bookingDoctor.token_price}.00</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: '#78716C' }}>Current Queue Length:</span>
                  <strong>{bookingDoctor.queue_length ?? 0} waiting</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#78716C' }}>Distance / Transit:</span>
                  <span>{bookingDoctor.distance_km} km (~{bookingDoctor.mock_transit_minutes}m)</span>
                </div>
              </div>

              <div style={{ margin: '14px 0' }}>
                <label style={hStyles.fieldLabel}>Patient Full Name</label>
                <input
                  style={hStyles.input}
                  value={bookPatientName}
                  onChange={(e) => setBookPatientName(e.target.value)}
                  placeholder="Patient Name"
                />
              </div>

              <div style={{ margin: '14px 0' }}>
                <label style={hStyles.fieldLabel}>Registered Verified Phone</label>
                <input
                  style={hStyles.inputDisabled}
                  value={currentUser?.phone || ''}
                  disabled
                />
              </div>

              <button
                style={hStyles.primaryHingeBtn}
                onClick={handleConfirmBooking}
                disabled={isBookingSubmitting}
              >
                {isBookingSubmitting ? 'Confirming Token...' : `Confirm & Reserve Token ($${bookingDoctor.token_price})`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// HINGE-INSPIRED STYLING SYSTEM
const hStyles: { [key: string]: React.CSSProperties } = {
  canvas: {
    backgroundColor: '#FAF8F5',
    minHeight: '100vh',
    color: '#1C1917',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '24px 16px',
    boxSizing: 'border-box',
  },
  wrapper: {
    maxWidth: 1040,
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottom: '1px solid #EFECE6',
  },
  brandKicker: {
    fontSize: '11px',
    letterSpacing: '2px',
    fontWeight: 700,
    color: '#7A2036',
    display: 'block',
  },
  brandTitle: {
    margin: 0,
    fontSize: '32px',
    fontFamily: 'Georgia, serif',
    color: '#1C1917',
    letterSpacing: '-0.5px',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  staffBtn: {
    padding: '8px 16px',
    borderRadius: 24,
    border: '1px solid #D6D3D1',
    backgroundColor: 'transparent',
    color: '#78716C',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  staffBtnActive: {
    padding: '8px 16px',
    borderRadius: 24,
    border: '1px solid #7A2036',
    backgroundColor: '#7A2036',
    color: '#FFFFFF',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  signInPill: {
    padding: '8px 20px',
    borderRadius: 24,
    backgroundColor: '#7A2036',
    color: '#FFFFFF',
    border: 0,
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  profilePill: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    border: '1px solid #EFECE6',
    borderRadius: 24,
    padding: '4px 14px 4px 6px',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(28,25,23,0.04)',
  },
  avatarCircle: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    backgroundColor: '#F5EBE6',
    color: '#7A2036',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: '13px',
  },
  tabNav: {
    display: 'flex',
    gap: 10,
    marginBottom: 24,
  },
  navTab: {
    padding: '10px 20px',
    borderRadius: 24,
    border: '1px solid #EFECE6',
    backgroundColor: '#FFFFFF',
    color: '#78716C',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  activeNavTab: {
    padding: '10px 20px',
    borderRadius: 24,
    border: '1px solid #7A2036',
    backgroundColor: '#7A2036',
    color: '#FFFFFF',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  searchSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    border: '1px solid #EFECE6',
    padding: '20px',
    marginBottom: 24,
    boxShadow: '0 4px 20px rgba(28,25,23,0.03)',
  },
  searchBarContainer: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#FAF8F5',
    border: '1px solid #EFECE6',
    borderRadius: 14,
    padding: '4px 14px',
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
    fontSize: '16px',
  },
  searchInput: {
    flex: 1,
    border: 0,
    backgroundColor: 'transparent',
    padding: '10px 0',
    fontSize: '15px',
    color: '#1C1917',
    outline: 'none',
  },
  clearBtn: {
    background: 'none',
    border: 0,
    color: '#A8A29E',
    cursor: 'pointer',
    fontSize: '14px',
  },
  chipScroller: {
    display: 'flex',
    gap: 8,
    overflowX: 'auto',
    paddingBottom: 10,
    scrollbarWidth: 'none',
  },
  chip: {
    padding: '6px 14px',
    borderRadius: 20,
    border: '1px solid #EFECE6',
    backgroundColor: '#FAF8F5',
    color: '#44403C',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  activeChip: {
    padding: '6px 14px',
    borderRadius: 20,
    border: '1px solid #7A2036',
    backgroundColor: '#F5EBE6',
    color: '#7A2036',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  filterBar: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 16,
    paddingTop: 16,
    borderTop: '1px solid #F5F2EC',
  },
  filterControl: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  filterLabelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: '#78716C',
  },
  filterLabel: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#78716C',
  },
  slider: {
    accentColor: '#7A2036',
    cursor: 'pointer',
  },
  sortSelect: {
    padding: '8px 12px',
    borderRadius: 10,
    border: '1px solid #EFECE6',
    backgroundColor: '#FAF8F5',
    fontSize: '13px',
    color: '#1C1917',
    outline: 'none',
  },
  resultsBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTop: '1px solid #F5F2EC',
    fontSize: '13px',
    color: '#78716C',
  },
  resetFiltersBtn: {
    background: 'none',
    border: 0,
    color: '#7A2036',
    fontWeight: 600,
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  doctorGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
    gap: 20,
  },
  doctorHingeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    border: '1px solid #EFECE6',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    boxShadow: '0 4px 18px rgba(28,25,23,0.03)',
    transition: 'transform 0.15s ease',
  },
  docCardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  deptBadge: {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: 12,
    backgroundColor: '#F5EBE6',
    color: '#7A2036',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.3px',
    marginBottom: 6,
  },
  deptBadgeSmall: {
    padding: '2px 8px',
    borderRadius: 10,
    backgroundColor: '#F5EBE6',
    color: '#7A2036',
    fontSize: '10px',
    fontWeight: 700,
  },
  docName: {
    margin: '0 0 2px 0',
    fontSize: '18px',
    fontFamily: 'Georgia, serif',
    color: '#1C1917',
  },
  docQual: {
    margin: 0,
    fontSize: '12px',
    color: '#78716C',
  },
  ratingPill: {
    backgroundColor: '#FAF8F5',
    border: '1px solid #EFECE6',
    padding: '4px 8px',
    borderRadius: 12,
    fontSize: '12px',
    fontWeight: 700,
    color: '#1C1917',
  },
  promptBox: {
    backgroundColor: '#FAF8F5',
    borderRadius: 14,
    padding: '12px',
    margin: '12px 0',
    border: '1px solid #EFECE6',
  },
  metaRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  metaPill: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #EFECE6',
    borderRadius: 8,
    padding: '3px 8px',
    fontSize: '11px',
    color: '#44403C',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  docCardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 14,
    borderTop: '1px solid #F5F2EC',
  },
  priceText: {
    fontSize: '20px',
    fontWeight: 800,
    color: '#1C1917',
  },
  bookBtn: {
    padding: '10px 18px',
    borderRadius: 20,
    backgroundColor: '#7A2036',
    color: '#FFFFFF',
    border: 0,
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  liveTurnCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    border: '2px solid #7A2036',
    padding: '20px',
    marginBottom: 24,
    boxShadow: '0 8px 30px rgba(122,32,54,0.08)',
  },
  liveTurnHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  liveTurnTag: {
    fontSize: '10px',
    fontWeight: 800,
    letterSpacing: '1px',
    color: '#7A2036',
  },
  turnBigNumber: {
    textAlign: 'center',
    fontSize: '28px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  advisoryStrip: {
    backgroundColor: '#FBF5F2',
    border: '1px solid #EFE0D8',
    borderRadius: 12,
    padding: '12px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '13px',
    flexWrap: 'wrap',
    gap: 8,
  },
  profileContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    border: '1px solid #EFECE6',
    padding: '28px',
    boxShadow: '0 4px 20px rgba(28,25,23,0.03)',
  },
  profileHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
  },
  avatarBig: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    backgroundColor: '#7A2036',
    color: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '28px',
    fontWeight: 700,
    fontFamily: 'Georgia, serif',
  },
  verifiedTag: {
    backgroundColor: '#E7F5EC',
    color: '#2D5A3D',
    padding: '2px 8px',
    borderRadius: 10,
    fontSize: '11px',
    fontWeight: 700,
  },
  editForm: {
    marginTop: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    maxWidth: 420,
  },
  fieldLabel: {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: '#78716C',
    marginBottom: 4,
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 12,
    border: '1px solid #D6D3D1',
    backgroundColor: '#FAF8F5',
    fontSize: '14px',
    boxSizing: 'border-box',
    outline: 'none',
  },
  inputDisabled: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 12,
    border: '1px solid #EFECE6',
    backgroundColor: '#F5F2EC',
    fontSize: '14px',
    color: '#78716C',
    boxSizing: 'border-box',
  },
  select: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 12,
    border: '1px solid #D6D3D1',
    backgroundColor: '#FAF8F5',
    fontSize: '14px',
    outline: 'none',
  },
  primaryHingeBtn: {
    padding: '12px 24px',
    borderRadius: 24,
    backgroundColor: '#7A2036',
    color: '#FFFFFF',
    border: 0,
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  logoutHingeBtn: {
    padding: '8px 18px',
    borderRadius: 20,
    backgroundColor: '#FEE2E2',
    color: '#991B1B',
    border: 0,
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  historySection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    border: '1px solid #EFECE6',
    padding: '24px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '32px 16px',
  },
  exploreLink: {
    marginTop: 10,
    background: 'none',
    border: 0,
    color: '#7A2036',
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: '14px',
  },
  bookingHistoryCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 18px',
    backgroundColor: '#FAF8F5',
    borderRadius: 16,
    border: '1px solid #EFECE6',
  },
  tokenBadge: {
    backgroundColor: '#7A2036',
    color: '#FFFFFF',
    padding: '2px 8px',
    borderRadius: 8,
    fontWeight: 800,
    fontSize: '12px',
  },
  statusCompleted: {
    backgroundColor: '#E7F5EC',
    color: '#2D5A3D',
    padding: '3px 10px',
    borderRadius: 12,
    fontSize: '11px',
    fontWeight: 700,
  },
  statusActive: {
    backgroundColor: '#FEF3C7',
    color: '#92400E',
    padding: '3px 10px',
    borderRadius: 12,
    fontSize: '11px',
    fontWeight: 700,
  },
  successAlert: {
    backgroundColor: '#E7F5EC',
    color: '#2D5A3D',
    padding: '8px 14px',
    borderRadius: 10,
    fontSize: '13px',
    marginTop: 12,
    fontWeight: 600,
  },
  outlineSmallBtn: {
    padding: '6px 14px',
    borderRadius: 20,
    border: '1px solid #D6D3D1',
    backgroundColor: 'transparent',
    color: '#44403C',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  outlineSmallBtnActive: {
    padding: '6px 14px',
    borderRadius: 20,
    border: '1px solid #7A2036',
    backgroundColor: '#F5EBE6',
    color: '#7A2036',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(28,25,23,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 16,
    backdropFilter: 'blur(3px)',
  },
  bookingModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: '28px',
    maxWidth: 440,
    width: '100%',
    boxShadow: '0 20px 30px rgba(0,0,0,0.15)',
  },
  modalClose: {
    background: 'none',
    border: 0,
    fontSize: 18,
    cursor: 'pointer',
    color: '#78716C',
  },
  adminCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    border: '1px solid #EFECE6',
    padding: '24px',
    marginBottom: 24,
  },
  adminButtonGroup: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  stageBtn: {
    padding: '8px 16px',
    borderRadius: 8,
    border: '1px solid #D6D3D1',
    backgroundColor: '#FAF8F5',
    cursor: 'pointer',
    fontSize: '13px',
  },
  stageActiveBtn: {
    padding: '8px 16px',
    borderRadius: 8,
    border: 0,
    backgroundColor: '#7A2036',
    color: '#FFFFFF',
    fontWeight: 700,
    fontSize: '13px',
  },
  completeBtn: {
    padding: '8px 16px',
    borderRadius: 8,
    border: 0,
    backgroundColor: '#2D5A3D',
    color: '#FFFFFF',
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: '13px',
  },
  breakBtn: {
    padding: '8px 16px',
    borderRadius: 8,
    border: 0,
    backgroundColor: '#D97706',
    color: '#FFFFFF',
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: '13px',
  },
  adminColumns: {
    display: 'grid',
    gridTemplateColumns: '1.4fr 1fr',
    gap: 20,
  },
  adminQueueRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    backgroundColor: '#FAF8F5',
    borderRadius: 10,
    marginBottom: 8,
  },
  walkinBox: {
    backgroundColor: '#FAF8F5',
    borderRadius: 16,
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  checkInPill: {
    padding: '4px 10px',
    borderRadius: 12,
    border: '1px solid #D6D3D1',
    backgroundColor: '#FFFFFF',
    fontSize: '11px',
    cursor: 'pointer',
  },
  checkedInPill: {
    padding: '4px 10px',
    borderRadius: 12,
    border: 0,
    backgroundColor: '#E7F5EC',
    color: '#2D5A3D',
    fontSize: '11px',
    fontWeight: 700,
  },
  posTag: {
    backgroundColor: '#EFECE6',
    padding: '2px 8px',
    borderRadius: 6,
    fontSize: '11px',
    fontWeight: 700,
  },
  emergencyBadge: {
    backgroundColor: '#FEE2E2',
    color: '#991B1B',
    padding: '2px 6px',
    borderRadius: 6,
    fontSize: '10px',
    fontWeight: 800,
    marginLeft: 6,
  },
};