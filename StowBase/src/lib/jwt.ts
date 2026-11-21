import crypto from 'crypto';

const JWT_ISSUER = 'stowbase';
const JWT_TTL_SECONDS = 60 * 60 * 12; // 12 hours

// Use process.env.JWT_SECRET when provided, otherwise an ephemeral per-process 256-bit key.
const JWT_SECRET =
  process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32
    ? process.env.JWT_SECRET
    : crypto.randomBytes(32).toString('hex');

// In-memory revoked token registry keyed by jti -> expiry timestamp (seconds)
const revokedTokens = new Map<string, number>();

export interface JwtClaims {
  sub: number;
  uid: string;
  email: string;
  displayName: string;
  iss: string;
  iat: number;
  exp: number;
  jti: string;
}

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLen), 'base64').toString('utf8');
}

function pruneRevokedTokens(): void {
  const now = Math.floor(Date.now() / 1000);
  for (const [jti, exp] of revokedTokens.entries()) {
    if (exp <= now) {
      revokedTokens.delete(jti);
    }
  }
}

export function signJwt(user: {
  id: number;
  uid: string;
  email: string;
  displayName: string;
}): { token: string; expiresAt: number } {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + JWT_TTL_SECONDS;
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload: JwtClaims = {
    sub: user.id,
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    iss: JWT_ISSUER,
    iat: now,
    exp,
    jti: crypto.randomUUID(),
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(signingInput)
    .digest();

  return {
    token: `${signingInput}.${base64UrlEncode(signature)}`,
    expiresAt: exp * 1000,
  };
}

export function verifyJwt(token: string): JwtClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  if (!encodedHeader || !encodedPayload || !encodedSignature) return null;

  try {
    const header = JSON.parse(base64UrlDecode(encodedHeader)) as {
      alg?: string;
      typ?: string;
    };
    if (header.alg !== 'HS256' || header.typ !== 'JWT') {
      return null;
    }

    const expectedSig = base64UrlEncode(
      crypto
        .createHmac('sha256', JWT_SECRET)
        .update(`${encodedHeader}.${encodedPayload}`)
        .digest()
    );

    const a = Buffer.from(encodedSignature, 'utf8');
    const b = Buffer.from(expectedSig, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }

    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as JwtClaims;
    const now = Math.floor(Date.now() / 1000);

    if (
      payload.iss !== JWT_ISSUER ||
      typeof payload.sub !== 'number' ||
      typeof payload.uid !== 'string' ||
      typeof payload.exp !== 'number' ||
      typeof payload.jti !== 'string' ||
      payload.exp <= now
    ) {
      return null;
    }

    if (revokedTokens.has(payload.jti)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function revokeJwt(jti: string, exp: number): void {
  pruneRevokedTokens();
  revokedTokens.set(jti, exp);
}

const SCRYPT_KEYLEN = 64;
const DUMMY_SALT = '00112233445566778899aabbccddeeff';

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_KEYLEN, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string | null | undefined
): Promise<boolean> {
  if (!storedHash) {
    // Perform dummy derivation to keep response timing consistent
    await new Promise<void>((resolve) => {
      crypto.scrypt(password, DUMMY_SALT, SCRYPT_KEYLEN, () => resolve());
    });
    return false;
  }

  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }

  const [, salt, keyHex] = parts;
  const expected = Buffer.from(keyHex, 'hex');
  const derived = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, expected.length, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });

  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}
