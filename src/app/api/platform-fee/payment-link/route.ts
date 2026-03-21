/**
 * POST /api/platform-fee/payment-link
 * Genera link de pago para que la escuela pague su mensualidad (admin/encargado_deportivo de la escuela).
 * Retorna checkoutUrl para redirigir a Mercado Pago.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminFirestore } from '@/lib/firebase-admin';
import {
  getOrCreatePlatformFeeConfig,
  getOrCreateClubFeeConfig,
  findApprovedClubFeePayment,
  getSchoolMonthlyAmount,
} from '@/lib/payments/platform-fee';
import { createPlatformFeePreference } from '@/lib/payments/mercadopago-platform-preference';
import { verifyIdToken } from '@/lib/auth-server';

const BodySchema = z.object({
  subcomisionId: z.string().min(1),
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Formato YYYY-MM'),
});

function getDueDate(period: string, dayOfMonth: number): Date {
  const [y, m] = period.split('-').map(Number);
  const day = Math.min(dayOfMonth, new Date(y, m, 0).getDate());
  return new Date(y, m - 1, day);
}

export async function POST(request: Request) {
  try {
    const auth = await verifyIdToken(request.headers.get('Authorization'));
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const platformToken = process.env.MERCADOPAGO_PLATFORM_ACCESS_TOKEN;
    if (!platformToken) {
      return NextResponse.json(
        { error: 'El pago online no está disponible en este momento. Contactá al administrador.' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { subcomisionId, period } = parsed.data;
    const schoolId = subcomisionId;
    const db = getAdminFirestore();

    const platformSnap = await db.collection('platformUsers').doc(auth.uid).get();
    const platformData = platformSnap.data() as { gerente_club?: boolean; super_admin?: boolean } | undefined;
    const isSuperAdmin = (platformData?.gerente_club ?? platformData?.super_admin) === true;
    const userInSchool = await db.collection('subcomisiones').doc(schoolId).collection('users').doc(auth.uid).get();
    const userData = userInSchool.data() as { role?: string } | undefined;
    const isSubcomisionAdmin = userData?.role === 'admin_subcomision';
    if (!isSuperAdmin && (!userInSchool.exists || !isSubcomisionAdmin)) {
      return NextResponse.json({ error: 'Solo el administrador de la escuela puede pagar la mensualidad' }, { status: 403 });
    }

    const existing = await findApprovedClubFeePayment(db, schoolId, period);
    if (existing) {
      return NextResponse.json(
        { error: 'Esta mensualidad ya está pagada' },
        { status: 409 }
      );
    }

    const platformConfig = await getOrCreatePlatformFeeConfig(db);
    const schoolConfig = await getOrCreateClubFeeConfig(db, schoolId);

    if (schoolConfig.isBonified) {
      return NextResponse.json(
        { error: 'Tu escuela está bonificada' },
        { status: 400 }
      );
    }

    const baseAmount = await getSchoolMonthlyAmount(db, schoolId, platformConfig);
    if (baseAmount <= 0) {
      return NextResponse.json(
        { error: 'No hay tarifa configurada' },
        { status: 400 }
      );
    }

    const dueDay = platformConfig.dueDayOfMonth ?? 10;
    const dueDate = getDueDate(period, dueDay);
    const now = new Date();
    const daysOverdue = dueDate <= now ? Math.floor((now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000)) : 0;
    const lateFeePct = (platformConfig.lateFeePercent ?? 5) / 100;
    const lateFeeAmount = Math.round(baseAmount * lateFeePct * Math.ceil(daysOverdue / 30));
    const totalAmount = baseAmount + lateFeeAmount;

    const schoolSnap = await db.collection('schools').doc(schoolId).get();
    const schoolName = schoolSnap.exists ? (schoolSnap.data()?.name ?? 'Escuela') : 'Escuela';

    const { init_point } = await createPlatformFeePreference(platformToken, {
      subcomisionId: schoolId,
      schoolName,
      period,
      amount: totalAmount,
      currency: platformConfig.currency ?? 'ARS',
    });

    return NextResponse.json({
      checkoutUrl: init_point,
      amount: totalAmount,
      currency: platformConfig.currency ?? 'ARS',
      lateFeeAmount,
    });
  } catch (e) {
    console.error('[platform-fee/payment-link]', e);
    return NextResponse.json(
      { error: 'Error al crear link de pago' },
      { status: 500 }
    );
  }
}
