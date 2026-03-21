import { SignJWT, jwtVerify } from 'jose';

const getSecret = () =>
  new TextEncoder().encode(process.env.QR_JWT_SECRET ?? 'fallback-secret-change-me');
const EXPIRACION_MINUTOS = 10;

export async function generarQRToken(
  socioId: string,
  numeroSocio: string
): Promise<string> {
  return await new SignJWT({ socioId, numeroSocio, programa: 'regatas-plus' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${EXPIRACION_MINUTOS}m`)
    .sign(getSecret());
}

export async function validarQRToken(
  token: string
): Promise<{ socioId: string; numeroSocio: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      socioId: payload.socioId as string,
      numeroSocio: payload.numeroSocio as string,
    };
  } catch {
    return null;
  }
}
