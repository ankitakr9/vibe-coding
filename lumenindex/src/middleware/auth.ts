import type { Request, Response, NextFunction } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../lib/firebase-admin.ts';
import { getOrCreateUser } from '../db/users.ts';
import type { UserRecord } from '../db/schema.ts';

export interface AuthRequest extends Request {
  firebaseUser?: DecodedIdToken;
  dbUser?: UserRecord;
}

async function resolveAuthToken(req: AuthRequest): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return;
  }

  const decoded = await adminAuth.verifyIdToken(token);
  req.firebaseUser = decoded;
  req.dbUser = await getOrCreateUser({
    uid: decoded.uid,
    email: decoded.email ?? `${decoded.uid}@user.local`,
    displayName: decoded.name ?? null,
    photoUrl: decoded.picture ?? null,
  });
}

export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    await resolveAuthToken(req);
  } catch (error) {
    console.warn('Optional auth token could not be verified:', error);
  }
  next();
};

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }

  try {
    await resolveAuthToken(req);
    if (!req.dbUser) {
      return res.status(401).json({ error: 'Invalid authentication token.' });
    }
    return next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
  }
};

export const requireAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    await resolveAuthToken(req);
    if (!req.dbUser) {
      return res.status(401).json({ error: 'Invalid authentication token.' });
    }
    if (req.dbUser.role !== 'admin') {
      return res.status(403).json({ error: 'Administrator privileges are required for this action.' });
    }
    return next();
  } catch (error) {
    console.error('Admin auth error:', error);
    return res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
  }
};
