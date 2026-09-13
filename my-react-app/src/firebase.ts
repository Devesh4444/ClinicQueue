export interface OtpSession {
  phone: string;
  mockOtp: string;
}

/**
 * Mock OTP service for development and testing.
 * Automatically generates a fixed test code (123456).
 */
export async function sendOtpToPhone(phoneNumber: string): Promise<OtpSession> {
  // Simulate brief network delay
  await new Promise((r) => setTimeout(r, 400));
  const mockOtp = '123456';
  return {
    phone: phoneNumber,
    mockOtp,
  };
}

export async function verifyPhoneOtp(
  session: OtpSession,
  code: string
): Promise<{ success: boolean; uid: string }> {
  await new Promise((r) => setTimeout(r, 300));
  if (code.trim() === session.mockOtp || code.trim() === '123456') {
    return {
      success: true,
      uid: 'mock-firebase-' + Date.now(),
    };
  }
  throw new Error('Invalid OTP. Use test code: 123456');
}
