import type { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { verifyJwt } from '../lib/jwt.ts';
import { getOrCreateUser, getUserById } from '../db/users.ts';
import type { UserRecord } from '../db/schema.ts';

export interface AuthSessionInfo {
  uid: string;
  email: string;
  displayName: string;
  method: 'jwt' | 'firebase';
  jti?: string;
  exp?: number;
}

export interface AuthRequest extends Request {
  authSession?: AuthSessionInfo;
  dbUser?: UserRecord;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  // 1. Try native HS256 JWT issued by /api/auth/login or /api/auth/register
  const jwtClaims = verifyJwt(token);
  if (jwtClaims) {
    try {
      const dbUser = await getUserById(jwtClaims.sub);
      if (!dbUser || dbUser.uid !== jwtClaims.uid) {
        res.status(401).json({ error: 'Session is no longer valid.' });
        return;
      }
      req.dbUser = dbUser;
      req.authSession = {
        uid: dbUser.uid,
        email: dbUser.email,
        displayName: dbUser.displayName ?? '',
        method: 'jwt',
        jti: jwtClaims.jti,
        exp: jwtClaims.exp,
      };
      next();
      return;
    } catch (error) {
      console.error('JWT user lookup failed:', error);
      res.status(500).json({ error: 'Unable to verify session.' });
      return;
    }
  }

  // 2. Fallback to Firebase Auth ID token (Google Sign-In)
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const dbUser = await getOrCreateUser(
      decodedToken.uid,
      decodedToken.email ?? '',
      decodedToken.name ?? ''
    );
    req.dbUser = dbUser;
    req.authSession = {
      uid: dbUser.uid,
      email: dbUser.email,
      displayName: dbUser.displayName ?? '',
      method: 'firebase',
    };
    next();
  } catch (error) {
    console.error('Auth verification failed:', error);
    res.status(401).json({ error: 'Invalid or expired session.' });
  }
};
