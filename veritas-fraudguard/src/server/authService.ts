import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { AuditLogEntry, AuthUser, UserRole, UserStatus } from '../shared/types.ts';

interface StoredUser extends AuthUser {
  passwordHash: string;
}

interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const JWT_SECRET =
  process.env.JWT_SECRET ||
  crypto.createHash('sha256').update('veritas-fraudguard-hmac-secret-2026').digest('hex');

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

function base64UrlEncode(input: string | Buffer): string {
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

export class AuthStore {
  private users: StoredUser[] = [];
  private auditLogs: AuditLogEntry[] = [];

  constructor() {
    this.loadOrSeedUsers();
    this.recordAudit(
      'system@veritasbank.com',
      'SYSTEM',
      'AUTH_ENGINE_INIT',
      'RBAC Policy',
      'SUCCESS',
      'Initialized HMAC-SHA256 JWT verifier and scrypt password store.'
    );
  }

  private loadOrSeedUsers(): void {
    try {
      if (fs.existsSync(USERS_FILE)) {
        const raw = fs.readFileSync(USERS_FILE, 'utf8');
        const parsed = JSON.parse(raw) as StoredUser[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.users = parsed;
          return;
        }
      }
    } catch {
      // Fallback to fresh seed if file corrupted
    }

    const now = new Date().toISOString();
    this.users = [
      {
        id: 'usr-admin-01',
        fullName: 'Claire Mercer',
        email: 'admin@veritasbank.com',
        role: 'ADMIN',
        status: 'ACTIVE',
        createdAt: now,
        lastLoginAt: now,
        passwordHash: hashPassword('Admin@2026!'),
      },
      {
        id: 'usr-analyst-01',
        fullName: 'Julian Brooks',
        email: 'analyst@veritasbank.com',
        role: 'ANALYST',
        status: 'ACTIVE',
        createdAt: now,
        lastLoginAt: null,
        passwordHash: hashPassword('Analyst@2026!'),
      },
      {
        id: 'usr-customer-01',
        fullName: 'Eleanor Vance',
        email: 'e.vance@meridianholdings.com',
        role: 'CUSTOMER',
        status: 'ACTIVE',
        linkedAccountId: 'acc-101',
        createdAt: now,
        lastLoginAt: null,
        passwordHash: hashPassword('Customer@2026!'),
      },
    ];
    this.persistUsers();
  }

  private persistUsers(): void {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(USERS_FILE, JSON.stringify(this.users, null, 2), 'utf8');
    } catch {
      // Non-fatal in read-only sandboxes
    }
  }

  private toPublicUser(u: StoredUser): AuthUser {
    const { passwordHash: _ignored, ...rest } = u;
    return rest;
  }

  public recordAudit(
    actorEmail: string,
    actorRole: UserRole | 'SYSTEM',
    action: string,
    target: string,
    outcome: 'SUCCESS' | 'DENIED',
    detail: string
  ): void {
    this.auditLogs.unshift({
      id: `AUD-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      timestamp: new Date().toISOString(),
      actorEmail,
      actorRole,
      action,
      target,
      outcome,
      detail,
    });
    if (this.auditLogs.length > 200) {
      this.auditLogs.pop();
    }
  }

  public getAuditLogs(): AuditLogEntry[] {
    return this.auditLogs;
  }

  public listUsers(): AuthUser[] {
    return this.users.map((u) => this.toPublicUser(u));
  }

  public getUserById(id: string): AuthUser | null {
    const found = this.users.find((u) => u.id === id);
    return found ? this.toPublicUser(found) : null;
  }

  public signToken(user: AuthUser): string {
    const nowSec = Math.floor(Date.now() / 1000);
    const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = base64UrlEncode(
      JSON.stringify({
        sub: user.id,
        email: user.email,
        role: user.role,
        iat: nowSec,
        exp: nowSec + 8 * 3600,
      } satisfies JwtPayload)
    );
    const signature = base64UrlEncode(
      crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest()
    );
    return `${header}.${payload}.${signature}`;
  }

  public verifyToken(token: string): AuthUser | null {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, payload, sig] = parts;
    const expectedSig = base64UrlEncode(
      crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest()
    );

    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    try {
      const decoded = JSON.parse(base64UrlDecode(payload)) as JwtPayload;
      if (decoded.exp < Math.floor(Date.now() / 1000)) {
        return null;
      }
      const user = this.users.find((u) => u.id === decoded.sub);
      if (!user || user.status !== 'ACTIVE') return null;
      return this.toPublicUser(user);
    } catch {
      return null;
    }
  }

  public login(
    emailInput: string,
    password: string
  ): { user: AuthUser; token: string } | { error: string; status: number } {
    const email = emailInput.trim().toLowerCase();
    const user = this.users.find((u) => u.email.toLowerCase() === email);

    if (!user || !verifyPassword(password, user.passwordHash)) {
      this.recordAudit(
        email || 'unknown',
        user?.role ?? 'SYSTEM',
        'LOGIN_ATTEMPT',
        'Auth Gateway',
        'DENIED',
        'Invalid email or password credentials rejected.'
      );
      return { error: 'Invalid email address or password.', status: 401 };
    }

    if (user.status === 'SUSPENDED') {
      this.recordAudit(
        user.email,
        user.role,
        'LOGIN_ATTEMPT',
        'Auth Gateway',
        'DENIED',
        'Account is suspended by an administrator.'
      );
      return {
        error: 'This account has been suspended by an administrator.',
        status: 403,
      };
    }

    user.lastLoginAt = new Date().toISOString();
    this.persistUsers();

    const pub = this.toPublicUser(user);
    const token = this.signToken(pub);
    this.recordAudit(
      pub.email,
      pub.role,
      'USER_LOGIN',
      'Auth Gateway',
      'SUCCESS',
      `Issued signed JWT session for role ${pub.role}.`
    );
    return { user: pub, token };
  }

  public register(input: {
    fullName: string;
    email: string;
    password: string;
    role: UserRole;
  }): { user: AuthUser; token: string } | { error: string; status: number } {
    const fullName = input.fullName.trim();
    const email = input.email.trim().toLowerCase();
    const password = input.password;

    if (fullName.length < 2) {
      return { error: 'Please enter your full name (at least 2 characters).', status: 400 };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { error: 'Please provide a valid email address.', status: 400 };
    }
    if (
      password.length < 8 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/[0-9]/.test(password)
    ) {
      return {
        error:
          'Password must be at least 8 characters and include uppercase, lowercase, and numeric characters.',
        status: 400,
      };
    }

    if (this.users.some((u) => u.email.toLowerCase() === email)) {
      return { error: 'An account with this email address already exists.', status: 409 };
    }

    // Security invariant: self-registration allows CUSTOMER or ANALYST; ADMIN must be promoted by an existing admin
    const safeRole: UserRole = input.role === 'ANALYST' ? 'ANALYST' : 'CUSTOMER';
    const now = new Date().toISOString();
    const newUser: StoredUser = {
      id: `usr-${crypto.randomBytes(4).toString('hex')}`,
      fullName,
      email,
      role: safeRole,
      status: 'ACTIVE',
      linkedAccountId: safeRole === 'CUSTOMER' ? 'acc-101' : undefined,
      createdAt: now,
      lastLoginAt: now,
      passwordHash: hashPassword(password),
    };

    this.users.unshift(newUser);
    this.persistUsers();

    const pub = this.toPublicUser(newUser);
    const token = this.signToken(pub);
    this.recordAudit(
      pub.email,
      pub.role,
      'USER_REGISTERED',
      'Identity Directory',
      'SUCCESS',
      `Registered new ${pub.role} account with scrypt salted password.`
    );
    return { user: pub, token };
  }

  public updateUserRole(
    actor: AuthUser,
    targetUserId: string,
    nextRole: UserRole
  ): AuthUser | null {
    const target = this.users.find((u) => u.id === targetUserId);
    if (!target) return null;
    const prevRole = target.role;
    target.role = nextRole;
    if (nextRole === 'CUSTOMER' && !target.linkedAccountId) {
      target.linkedAccountId = 'acc-101';
    }
    this.persistUsers();
    this.recordAudit(
      actor.email,
      actor.role,
      'RBAC_ROLE_CHANGED',
      target.email,
      'SUCCESS',
      `Updated role from ${prevRole} to ${nextRole}.`
    );
    return this.toPublicUser(target);
  }

  public updateUserStatus(
    actor: AuthUser,
    targetUserId: string,
    nextStatus: UserStatus
  ): AuthUser | null {
    const target = this.users.find((u) => u.id === targetUserId);
    if (!target || target.id === actor.id) return null;
    target.status = nextStatus;
    this.persistUsers();
    this.recordAudit(
      actor.email,
      actor.role,
      'USER_STATUS_CHANGED',
      target.email,
      'SUCCESS',
      `Changed account status to ${nextStatus}.`
    );
    return this.toPublicUser(target);
  }
}
