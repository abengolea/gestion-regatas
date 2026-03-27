import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/auth-server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import {
  canListPendingAccessRequests,
  isGerenteClubFromDb,
  listSubcomisionMembershipsByEmail,
} from '@/lib/school-membership-server';

/**
 * GET /api/access-requests
 * Lista solicitudes de acceso pendientes (staff de subcomisión o gerente). Admin SDK — no depende de reglas de cliente.
 */
export async function GET(request: Request) {
  try {
    const auth = await verifyIdToken(request.headers.get('Authorization'));
    if (!auth?.uid || !auth.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const memberships = await listSubcomisionMembershipsByEmail(auth.email);
    const gerente = await isGerenteClubFromDb(auth.uid, auth.email);
    if (!canListPendingAccessRequests(memberships, gerente)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const db = getAdminFirestore();
    const snap = await db.collection('accessRequests').where('status', '==', 'pending').limit(50).get();

    const requests = snap.docs.map((d) => {
      const x = d.data();
      const createdAt =
        x.createdAt && typeof (x.createdAt as { toDate?: () => Date }).toDate === 'function'
          ? (x.createdAt as { toDate: () => Date }).toDate()
          : null;
      return {
        id: d.id,
        uid: x.uid,
        email: x.email,
        displayName: x.displayName,
        type: x.type ?? 'player',
        status: x.status,
        createdAt: createdAt ? createdAt.toISOString() : null,
      };
    });

    return NextResponse.json({ requests });
  } catch (e) {
    console.error('[api/access-requests GET]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
