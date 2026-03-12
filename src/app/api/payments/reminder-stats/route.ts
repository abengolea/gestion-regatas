/**
 * GET /api/payments/reminder-stats?schoolId=xxx
 * Estadísticas de recordatorios enviados (hoy, este mes, límite diario).
 */

import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyIdToken } from '@/lib/auth-server';
import admin from 'firebase-admin';

const DAILY_LIMIT = 200;

export async function GET(request: Request) {
  try {
    const auth = await verifyIdToken(request.headers.get('Authorization'));
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');
    if (!schoolId) {
      return NextResponse.json({ error: 'Falta schoolId' }, { status: 400 });
    }

    const db = getAdminFirestore();

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

    const [todaySnap, monthSnap] = await Promise.all([
      db
        .collection('emailEvents')
        .where('type', '==', 'payment_reminder_manual')
        .where('schoolId', '==', schoolId)
        .where('sentAt', '>=', admin.firestore.Timestamp.fromDate(todayStart))
        .get(),
      db
        .collection('emailEvents')
        .where('type', '==', 'payment_reminder_manual')
        .where('schoolId', '==', schoolId)
        .where('sentAt', '>=', admin.firestore.Timestamp.fromDate(monthStart))
        .get(),
    ]);

    const sentToday = todaySnap.size;
    const sentMonth = monthSnap.size;
    const remainingToday = Math.max(0, DAILY_LIMIT - sentToday);

    return NextResponse.json({
      sentToday,
      sentMonth,
      dailyLimit: DAILY_LIMIT,
      remainingToday,
    });
  } catch (e) {
    console.error('[payments/reminder-stats]', e);
    return NextResponse.json(
      { error: 'Error al obtener estadísticas' },
      { status: 500 }
    );
  }
}
