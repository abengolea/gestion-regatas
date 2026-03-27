import { NextResponse } from 'next/server';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { verifyIdToken } from '@/lib/auth-server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import {
  canApproveAccessRequestsForSchool,
  canListPendingAccessRequests,
  isGerenteClubFromDb,
  listSubcomisionMembershipsByEmail,
} from '@/lib/school-membership-server';

type ActionBody = {
  action: 'approve' | 'reject';
  activeSchoolId?: string;
  /** `"new"` o ID de socio existente */
  linkToPlayerId?: string | 'new';
};

/**
 * POST /api/access-requests/[requestId]
 * Aprobar o rechazar solicitud (Admin SDK).
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await context.params;
    const auth = await verifyIdToken(request.headers.get('Authorization'));
    if (!auth?.uid || !auth.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: ActionBody;
    try {
      body = (await request.json()) as ActionBody;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const memberships = await listSubcomisionMembershipsByEmail(auth.email);
    const gerente = await isGerenteClubFromDb(auth.uid, auth.email);
    if (!canListPendingAccessRequests(memberships, gerente)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const db = getAdminFirestore();
    const reqRef = db.collection('accessRequests').doc(requestId);
    const accessSnap = await reqRef.get();
    if (!accessSnap.exists) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const reqData = accessSnap.data() as { status?: string; email?: string; displayName?: string };
    if (reqData.status !== 'pending') {
      return NextResponse.json({ error: 'Already processed' }, { status: 409 });
    }

    if (body.action === 'reject') {
      await reqRef.update({ status: 'rejected' });
      return NextResponse.json({ ok: true });
    }

    if (body.action !== 'approve') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const activeSchoolId = body.activeSchoolId;
    if (!activeSchoolId || !canApproveAccessRequestsForSchool(memberships, gerente, activeSchoolId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const linkToPlayerId = body.linkToPlayerId  as string | undefined;
    if (linkToPlayerId !== 'new' && (typeof linkToPlayerId !== 'string' || !linkToPlayerId)) {
      return NextResponse.json({ error: 'linkToPlayerId required (or "new")' }, { status: 400 });
    }

    const emailNorm = String(reqData.email ?? '').trim().toLowerCase();
    const displayName = String(reqData.displayName ?? '').trim() || 'Jugador';

    if (linkToPlayerId === 'new') {
      const nameParts = displayName.split(/\s+/);
      const firstName = nameParts[0] || 'Jugador';
      const lastName = nameParts.slice(1).join(' ') || '';

      const sociosCol = db.collection('subcomisiones').doc(activeSchoolId).collection('socios');
      const newSocioRef = sociosCol.doc();

      const batch = db.batch();
      batch.set(newSocioRef, {
        firstName,
        lastName,
        birthDate: Timestamp.fromDate(new Date('2010-01-01')),
        email: emailNorm,
        tutorContact: { name: 'Por completar', phone: '' },
        status: 'active',
        observations: `Aprobado desde solicitud de acceso el ${format(new Date(), 'PPP', { locale: es })}.`,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: auth.uid,
      });
      batch.set(db.collection('socioLogins').doc(emailNorm), {
        subcomisionId: activeSchoolId,
        socioId: newSocioRef.id,
      });
      batch.update(reqRef, {
        status: 'approved',
        approvedSchoolId: activeSchoolId,
        approvedPlayerId: newSocioRef.id,
        approvedAt: FieldValue.serverTimestamp(),
      });

      const dupesSnap = await db
        .collection('accessRequests')
        .where('email', '==', emailNorm)
        .where('status', '==', 'pending')
        .get();
      dupesSnap.docs.forEach((d) => {
        if (d.id !== requestId) batch.update(d.ref, { status: 'rejected' });
      });

      await batch.commit();
      return NextResponse.json({ ok: true, playerId: newSocioRef.id });
    }

    const socioRef = db
      .collection('subcomisiones')
      .doc(activeSchoolId)
      .collection('socios')
      .doc(linkToPlayerId);
    const socioSnap = await socioRef.get();
    if (!socioSnap.exists) {
      return NextResponse.json({ error: 'Jugador no encontrado' }, { status: 404 });
    }

    const batch = db.batch();
    batch.update(socioRef, { email: emailNorm });
    batch.set(db.collection('socioLogins').doc(emailNorm), {
      subcomisionId: activeSchoolId,
      socioId: linkToPlayerId,
    });
    batch.update(reqRef, {
      status: 'approved',
      approvedSchoolId: activeSchoolId,
      approvedPlayerId: linkToPlayerId,
      approvedAt: FieldValue.serverTimestamp(),
    });

    const dupesSnap = await db
      .collection('accessRequests')
      .where('email', '==', emailNorm)
      .where('status', '==', 'pending')
      .get();
    dupesSnap.docs.forEach((d) => {
      if (d.id !== requestId) batch.update(d.ref, { status: 'rejected' });
    });

    await batch.commit();
    return NextResponse.json({ ok: true, playerId: linkToPlayerId });
  } catch (e) {
    console.error('[api/access-requests POST]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
