import { auth } from './firebase';

// Store JWT strictly in memory (never localStorage or sessionStorage).
let inMemoryJwtToken: string | null = null;

export function setJwtToken(token: string | null): void {
  inMemoryJwtToken = token;
}

export function getJwtToken(): string | null {
  return inMemoryJwtToken;
}

export async function resolveBearerToken(): Promise<string | null> {
  if (inMemoryJwtToken) {
    return inMemoryJwtToken;
  }
  const firebaseUser = auth.currentUser;
  if (firebaseUser) {
    return firebaseUser.getIdToken();
  }
  return null;
}
