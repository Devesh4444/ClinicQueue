import React, { useState, useEffect } from 'react';
import type { User } from '../type';
import { sendOtpToPhone, verifyPhoneOtp, type OtpSession } from '../firebase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User, token: string) => void;
  apiBase: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  apiBase,
}) => {
  const [tab, setTab] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');

  // Login state
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup state
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupPassword, setSignupPassword] = useState('');

  // Mock OTP flow state
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('123456');
  const [otpSession, setOtpSession] = useState<OtpSession | null>(null);
  const [countdown, setCountdown] = useState(30);

  // Status state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timer: any;
    if (isOtpSent && countdown > 0) {
      timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [isOtpSent, countdown]);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!loginPhone.trim() || !loginPassword) {
      setError('Please enter your phone number and password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${apiBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: loginPhone.trim(), password: loginPassword }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      onSuccess(data.user, data.token);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!signupName.trim() || !signupEmail.trim() || !signupPhone.trim() || !signupPassword) {
      setError('All fields are required.');
      return;
    }

    if (signupPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);
    try {
      const session = await sendOtpToPhone(signupPhone.trim());
      setOtpSession(session);
      setOtpCode(session.mockOtp); // Pre-fill with mock OTP 123456 for instant testing
      setIsOtpSent(true);
      setCountdown(30);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!otpSession) {
      setError('Please request an OTP first.');
      return;
    }

    setIsLoading(true);
    try {
      const verifyResult = await verifyPhoneOtp(otpSession, otpCode.trim());

      const res = await fetch(`${apiBase}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: signupName.trim(),
          email: signupEmail.trim(),
          phone: signupPhone.trim(),
          password: signupPassword,
          firebaseUid: verifyResult.uid,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Signup failed');

      onSuccess(data.user, data.token);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h3 style={{ margin: 0 }}>Customer Portal</h3>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Tab switchers */}
        <div style={styles.tabs}>
          <button
            style={tab === 'LOGIN' ? styles.activeTab : styles.tab}
            onClick={() => { setTab('LOGIN'); setError(null); }}
          >
            Log In
          </button>
          <button
            style={tab === 'SIGNUP' ? styles.activeTab : styles.tab}
            onClick={() => { setTab('SIGNUP'); setError(null); }}
          >
            Sign Up
          </button>
        </div>

        {error && <div style={styles.errorAlert}>{error}</div>}

        {/* LOGIN TAB */}
        {tab === 'LOGIN' && (
          <form onSubmit={handleLogin} style={styles.form}>
            <div>
              <label style={styles.label}>Phone Number</label>
              <input
                type="tel"
                placeholder="e.g. 9876543210"
                style={styles.input}
                value={loginPhone}
                onChange={(e) => setLoginPhone(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={styles.label}>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                style={styles.input}
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" style={styles.submitBtn} disabled={isLoading}>
              {isLoading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
        )}

        {/* SIGNUP TAB */}
        {tab === 'SIGNUP' && (
          <div>
            {!isOtpSent ? (
              <form onSubmit={handleSendOtp} style={styles.form}>
                <div>
                  <label style={styles.label}>Full Name</label>
                  <input
                    type="text"
                    placeholder="Alex Johnson"
                    style={styles.input}
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={styles.label}>Email Address</label>
                  <input
                    type="email"
                    placeholder="alex@example.com"
                    style={styles.input}
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={styles.label}>Phone Number</label>
                  <input
                    type="tel"
                    placeholder="9876543210"
                    style={styles.input}
                    value={signupPhone}
                    onChange={(e) => setSignupPhone(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={styles.label}>Password (min 6 chars)</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    style={styles.input}
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" style={styles.submitBtn} disabled={isLoading}>
                  {isLoading ? 'Sending OTP...' : 'Send OTP to Phone'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyAndRegister} style={styles.form}>
                <div style={styles.otpNotice}>
                  📱 Mock OTP sent to <strong>{signupPhone}</strong>
                  <div style={{ marginTop: 4, color: '#16a34a', fontWeight: 700 }}>
                    Test Code: 123456
                  </div>
                </div>

                <div>
                  <label style={{ ...styles.label, textAlign: 'center' }}>Enter 6-digit OTP</label>
                  <input
                    type="text"
                    maxLength={6}
                    style={styles.otpInput}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    required
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <button
                    type="button"
                    style={styles.textBtn}
                    onClick={() => setIsOtpSent(false)}
                  >
                    ← Edit Details
                  </button>
                  <span style={{ color: '#64748b' }}>
                    {countdown > 0 ? `Resend in ${countdown}s` : 'Ready to resend'}
                  </span>
                </div>

                <button type="submit" style={styles.submitBtn} disabled={isLoading || otpCode.length < 6}>
                  {isLoading ? 'Verifying...' : 'Verify OTP & Register'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    padding: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    width: '100%',
    maxWidth: 400,
    borderRadius: 12,
    padding: 24,
    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  closeBtn: { background: 'none', border: 0, fontSize: 18, cursor: 'pointer', color: '#64748b' },
  tabs: { display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: 16 },
  tab: { flex: 1, padding: '10px', border: 0, background: 'none', color: '#64748b', fontWeight: 600, cursor: 'pointer' },
  activeTab: { flex: 1, padding: '10px', border: 0, borderBottom: '2px solid #2563eb', background: 'none', color: '#2563eb', fontWeight: 700, cursor: 'pointer' },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  label: { display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: 4 },
  input: { width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' },
  otpInput: { width: '100%', padding: '10px', textAlign: 'center', letterSpacing: '8px', fontSize: '22px', fontWeight: 800, borderRadius: 6, border: '1px solid #2563eb', boxSizing: 'border-box' },
  submitBtn: { width: '100%', padding: '12px', backgroundColor: '#2563eb', color: '#fff', border: 0, borderRadius: 6, fontWeight: 700, cursor: 'pointer', marginTop: 4 },
  textBtn: { background: 'none', border: 0, color: '#2563eb', cursor: 'pointer', padding: 0, fontSize: '13px' },
  errorAlert: { backgroundColor: '#fee2e2', color: '#b91c1c', padding: '8px 12px', borderRadius: 6, fontSize: '13px', marginBottom: 12 },
  otpNotice: { background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 12px', borderRadius: 6, fontSize: '13px', textAlign: 'center', marginBottom: 8 },
};
