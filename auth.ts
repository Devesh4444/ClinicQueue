import crypto from 'crypto';

const AUTH_SECRET = process.env.AUTH_SECRET || 'clinic-queue-native-secret-key-secure-2026';
const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Hash a plain text password using Node's native scrypt with a random 16-byte salt.
 */
export function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

/**
 * Verify a plain text password against a stored salt:hash string using timingSafeEqual.
 */
export function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const parts = storedHash.split(':');
    if (parts.length !== 2) return resolve(false);

    const [salt, keyHex] = parts;
    const keyBuffer = Buffer.from(keyHex, 'hex');

    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      if (keyBuffer.length !== derivedKey.length) {
        return resolve(false);
      }
      resolve(crypto.timingSafeEqual(keyBuffer, derivedKey));
    });
  });
}

export interface TokenPayload {
  userId: string;
  phone: string;
  email: string;
  fullName: string;
  exp: number;
}

/**
 * Generates a lightweight HMAC-SHA256 signed token without external dependencies.
 */
export function generateToken(user: { id: string; phone: string; email: string; full_name: string }): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload: TokenPayload = {
    userId: user.id,
    phone: user.phone,
    email: user.email,
    fullName: user.full_name,
    exp: Date.now() + TOKEN_EXPIRY_MS,
  };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const data = `${header}.${payloadStr}`;
  const signature = crypto.createHmac('sha256', AUTH_SECRET).update(data).digest('base64url');

  return `${data}.${signature}`;
}

/**
 * Verifies and decodes an HMAC-SHA256 signed token.
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, payloadStr, signature] = parts;
    const data = `${header}.${payloadStr}`;
    const expectedSignature = crypto.createHmac('sha256', AUTH_SECRET).update(data).digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSignature);

    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    const payload: TokenPayload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
    if (!payload.exp || Date.now() > payload.exp) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
