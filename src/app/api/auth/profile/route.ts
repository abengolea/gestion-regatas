/**
 * GET /api/auth/profile
 * Resuelve el perfil del usuario autenticado (fallback server-side).
 * Usa Firebase Admin para evitar restricciones de reglas del cliente.
 */

import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/auth-server';
import { getAdminFirestore } from '@/lib/firebase-admin';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const auth = await verifyIdToken(authHeader);
    if (!auth?.uid || !auth?.email) {
      return NextResponse.json({ profile: null }, { status: 200 });
    }

    const emailNorm = auth.email.trim().toLowerCase();

    // Super admin
    const db = getAdminFirestore();
    const platformSnap = await db.collection('platformUsers').doc(auth.uid).get();
    const platformData = platformSnap.data() as { super_admin?: boolean; gerente_club?: boolean } | undefined;
    if (platformData?.super_admin === true || platformData?.gerente_club === true || auth.email === 'abengolea1@gmail.com') {
      return NextResponse.json({
        profile: {
          id: auth.uid,
          uid: auth.uid,
          displayName: auth.displayName || auth.email || 'Super Admin',
          email: auth.email,
          role: 'admin_subcomision',
          isSuperAdmin: true,
          activeSchoolId: undefined,
          memberships: [],
        },
      });
    }

    // Buscar en subcomisiones/*/users por email.
    // Intentar collectionGroup primero; si falla (ej. índice), iterar subcomisiones.
    let memberships: { subcomisionId: string; schoolId: string; role: string; displayName: string; email: string }[] = [];

    try {
      const usersSnap = await db.collectionGroup('users').where('email', '==', emailNorm).get();
      if (!usersSnap.empty) {
        memberships = usersSnap.docs.map((d) => {
          const subcomisionId = d.ref.parent.parent?.id ?? '';
          const data = d.data() as { role: string; displayName?: string; email?: string };
          return {
            subcomisionId,
            schoolId: subcomisionId,
            role: data.role,
            displayName: data.displayName ?? '',
            email: data.email ?? emailNorm,
          };
        });
      }
    } catch {
      // Fallback: iterar subcomisiones (no requiere índice collection group)
      const subcomisionesSnap = await db.collection('subcomisiones').get();
      for (const subDoc of subcomisionesSnap.docs) {
        const subcomisionId = subDoc.id;
        const usersSnap = await db.collection('subcomisiones').doc(subcomisionId).collection('users').where('email', '==', emailNorm).limit(1).get();
        if (!usersSnap.empty) {
          const d = usersSnap.docs[0];
          const data = d.data() as { role: string; displayName?: string; email?: string };
          memberships.push({
            subcomisionId,
            schoolId: subcomisionId,
            role: data.role,
            displayName: data.displayName ?? '',
            email: data.email ?? emailNorm,
          });
        }
      }
    }

    if (memberships.length > 0) {
      const first = memberships[0];
      return NextResponse.json({
        profile: {
          id: auth.uid,
          uid: auth.uid,
          role: first?.role,
          displayName: first?.displayName || auth.email,
          email: auth.email,
          isSuperAdmin: false,
          activeSchoolId: first?.subcomisionId,
          memberships,
        },
      });
    }

    // Fallback: socioLogins (jugador)
    const loginSnap = await db.collection('socioLogins').doc(emailNorm).get();
    if (!loginSnap.exists) {
      return NextResponse.json({ profile: null }, { status: 200 });
    }

    const loginData = loginSnap.data() as { subcomisionId?: string; schoolId?: string; socioId?: string; playerId?: string };
    const schoolId = loginData.subcomisionId ?? loginData.schoolId ?? '';
    const playerId = loginData.socioId ?? loginData.playerId ?? '';
    if (!schoolId || !playerId) {
      return NextResponse.json({ profile: null }, { status: 200 });
    }

    const playerSnap = await db.collection('subcomisiones').doc(schoolId).collection('socios').doc(playerId).get();
    if (!playerSnap.exists) {
      return NextResponse.json({ profile: null }, { status: 200 });
    }

    const socioData = playerSnap.data() as { status?: string; nombre?: string; firstName?: string; apellido?: string; lastName?: string };
    const status = socioData?.status;
    if (status !== 'active' && status !== true) {
      return NextResponse.json({ profile: null }, { status: 200 });
    }

    const displayName = [socioData?.nombre ?? socioData?.firstName, socioData?.apellido ?? socioData?.lastName].filter(Boolean).join(' ') || auth.email || 'Socio';

    return NextResponse.json({
      profile: {
        id: auth.uid,
        uid: auth.uid,
        role: 'player',
        displayName,
        email: auth.email,
        isSuperAdmin: false,
        activeSchoolId: schoolId,
        socioId: playerId,
        playerId,
        memberships: [{ subcomisionId: schoolId, schoolId, role: 'player' as const, displayName, email: auth.email, socioId: playerId, playerId }],
      },
    });
  } catch (e) {
    console.error('[api/auth/profile]', e);
    return NextResponse.json({ profile: null }, { status: 200 });
  }
}
