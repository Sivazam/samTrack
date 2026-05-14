/**
 * Shared auth verification for Next.js API routes.
 * Uses Firebase Admin SDK to verify ID tokens from Authorization header.
 */
import { NextRequest } from 'next/server';

interface VerifiedUser {
  uid: string;
  email?: string;
  phone?: string;
  role?: string;
  tenantId?: string;
}

/**
 * Verify the caller's Firebase ID token from the Authorization header.
 * Returns the decoded user or null if verification fails.
 * 
 * Usage:
 *   const user = await verifyApiAuth(request);
 *   if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 */
export async function verifyApiAuth(request: NextRequest): Promise<VerifiedUser | null> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const idToken = authHeader.substring(7);
    if (!idToken || idToken.length < 20) {
      return null;
    }

    const { getFirebaseAuth } = await import('@/lib/firebase-admin');
    const adminAuth = getFirebaseAuth();
    const decoded = await adminAuth.verifyIdToken(idToken);

    return {
      uid: decoded.uid,
      email: decoded.email,
      phone: decoded.phone_number,
      role: decoded.role as string | undefined,
      tenantId: decoded.tenantId as string | undefined,
    };
  } catch (error) {
    console.warn('API auth verification failed:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}
