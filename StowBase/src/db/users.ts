import crypto from 'crypto';
import { eq, sql } from 'drizzle-orm';
import { db } from './index.ts';
import { users, type UserRecord } from './schema.ts';
import { hashPassword, verifyPassword } from '../lib/jwt.ts';

export interface SafeUserProfile {
  id: number;
  uid: string;
  email: string;
  displayName: string;
}

export class AuthConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthConflictError';
  }
}

export function toSafeUserProfile(record: UserRecord): SafeUserProfile {
  return {
    id: record.id,
    uid: record.uid,
    email: record.email,
    displayName: record.displayName ?? '',
  };
}

export async function getOrCreateUser(
  uid: string,
  email: string,
  displayName?: string
): Promise<UserRecord> {
  try {
    const safeEmail = (email || `${uid}@user.local`).trim().toLowerCase();
    const safeName = displayName?.trim() ?? '';

    const result = await db
      .insert(users)
      .values({
        uid,
        email: safeEmail,
        displayName: safeName,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: safeEmail,
          ...(safeName ? { displayName: safeName } : {}),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Failed to sync user record:', error);
    throw new Error('Unable to synchronize user profile.', { cause: error });
  }
}

export async function getUserById(id: number): Promise<UserRecord | null> {
  try {
    const [found] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return found ?? null;
  } catch (error) {
    console.error('Failed to look up user by ID:', error);
    throw new Error('Unable to verify account.', { cause: error });
  }
}

export async function registerLocalUser(input: {
  email: string;
  password: string;
  displayName: string;
}): Promise<SafeUserProfile> {
  const normalizedEmail = input.email.trim().toLowerCase();

  try {
    const existing = await db
      .select({ id: users.id, passwordHash: users.passwordHash })
      .from(users)
      .where(sql`lower(${users.email}) = ${normalizedEmail}`)
      .limit(1);

    if (existing.length > 0) {
      throw new AuthConflictError('An account with this email address already exists.');
    }

    const passwordHash = await hashPassword(input.password);
    const uid = `local:${crypto.randomUUID()}`;

    const [created] = await db
      .insert(users)
      .values({
        uid,
        email: normalizedEmail,
        displayName: input.displayName.trim(),
        passwordHash,
      })
      .returning();

    return toSafeUserProfile(created);
  } catch (error) {
    if (error instanceof AuthConflictError) {
      throw error;
    }
    console.error('Failed to register user:', error);
    throw new Error('Unable to complete registration. Please try again.', { cause: error });
  }
}

export async function authenticateLocalUser(input: {
  email: string;
  password: string;
}): Promise<SafeUserProfile | null> {
  const normalizedEmail = input.email.trim().toLowerCase();

  try {
    const matching = await db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${normalizedEmail}`);

    const localAccount = matching.find((u) => Boolean(u.passwordHash)) ?? null;
    const isValid = await verifyPassword(input.password, localAccount?.passwordHash);

    if (!localAccount || !isValid) {
      return null;
    }

    return toSafeUserProfile(localAccount);
  } catch (error) {
    console.error('Failed to authenticate user:', error);
    throw new Error('Unable to sign in right now. Please try again.', { cause: error });
  }
}
