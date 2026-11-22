import { eq } from 'drizzle-orm';
import { db } from './index.ts';
import { users, type UserRecord } from './schema.ts';

const INITIAL_ADMIN_EMAILS = new Set(['ak95349135@gmail.com']);

export async function getOrCreateUser(params: {
  uid: string;
  email: string;
  displayName?: string | null;
  photoUrl?: string | null;
}): Promise<UserRecord> {
  const normalizedEmail = params.email.trim().toLowerCase();
  const isInitialAdmin = INITIAL_ADMIN_EMAILS.has(normalizedEmail);

  try {
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.uid, params.uid))
      .limit(1);

    if (existing.length > 0) {
      const current = existing[0];
      const nextRole =
        isInitialAdmin && current.role !== 'admin' ? 'admin' : current.role;

      const updated = await db
        .update(users)
        .set({
          email: normalizedEmail,
          displayName: params.displayName ?? current.displayName,
          photoUrl: params.photoUrl ?? current.photoUrl,
          role: nextRole,
          updatedAt: new Date(),
        })
        .where(eq(users.uid, params.uid))
        .returning();

      return updated[0];
    }

    const inserted = await db
      .insert(users)
      .values({
        uid: params.uid,
        email: normalizedEmail,
        displayName: params.displayName ?? null,
        photoUrl: params.photoUrl ?? null,
        role: isInitialAdmin ? 'admin' : 'user',
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: normalizedEmail,
          displayName: params.displayName ?? null,
          photoUrl: params.photoUrl ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();

    return inserted[0];
  } catch (error) {
    console.error('Database error in getOrCreateUser:', error);
    throw new Error('Unable to load user profile. Please try again later.', {
      cause: error,
    });
  }
}

export async function getUserByUid(uid: string): Promise<UserRecord | null> {
  try {
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.uid, uid))
      .limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database error in getUserByUid:', error);
    throw new Error('Unable to fetch user record. Please try again later.', {
      cause: error,
    });
  }
}
