import type { NextFunction, Request, Response } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import fs from 'node:fs';
import path from 'node:path';

interface FirebaseAppletConfig {
  projectId: string;
  firestoreDatabaseId: string;
}

const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as FirebaseAppletConfig;

export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
export const FIRESTORE_DATABASE_ID = firebaseConfig.firestoreDatabaseId || '(default)';
export const INITIAL_ADMIN_EMAIL = (process.env.INITIAL_ADMIN_EMAIL || 'okumuvelmaatieno@gmail.com').toLowerCase();

const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

export interface AuthenticatedUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  name: string;
}

export interface AuthenticatedRequest extends Request {
  authUser?: AuthenticatedUser;
  idToken?: string;
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const customAuth = req.headers['x-firebase-auth'];
    const rawHeader = typeof customAuth === 'string' ? customAuth : req.headers.authorization;
    if (!rawHeader || !rawHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required. Missing Bearer token.' });
      return;
    }

    const token = rawHeader.slice('Bearer '.length).trim();
    if (!token) {
      res.status(401).json({ error: 'Authentication required. Empty Bearer token.' });
      return;
    }

    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    });

    const uid = typeof payload.sub === 'string' ? payload.sub : '';
    const email = typeof payload.email === 'string' ? payload.email : '';
    const emailVerified = payload.email_verified === true;
    const name = typeof payload.name === 'string' ? payload.name : '';

    if (!uid || !email) {
      res.status(401).json({ error: 'Invalid authentication token claims.' });
      return;
    }

    if (!emailVerified) {
      res.status(403).json({
        error: 'Email verification is required before performing this operation.',
        code: 'EMAIL_NOT_VERIFIED',
      });
      return;
    }

    req.authUser = { uid, email, emailVerified, name };
    req.idToken = token;
    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid or expired authentication token.';
    res.status(401).json({ error: 'Unauthorized: ' + message });
  }
}
