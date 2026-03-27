import { SignJWT, jwtVerify } from "jose";

const getSecret = () =>
  new TextEncoder().encode(
    process.env.ENTRADAS_ABONADO_JWT_SECRET?.trim() || process.env.QR_JWT_SECRET || "fallback-secret-change-me"
  );

const ISS = "entradas-abonado";
const EXP_HOURS = 4;

export type AbonadoEntradasClaims = {
  subcomisionId: string;
  socioId: string;
  numeroSocio: string;
};

export async function signAbonadoEntradasToken(claims: AbonadoEntradasClaims): Promise<string> {
  return new SignJWT({
    subcomisionId: claims.subcomisionId,
    socioId: claims.socioId,
    numeroSocio: claims.numeroSocio,
    scope: "entradas_abonado",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISS)
    .setIssuedAt()
    .setExpirationTime(`${EXP_HOURS}h`)
    .sign(getSecret());
}

export async function verifyAbonadoEntradasToken(token: string): Promise<AbonadoEntradasClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { issuer: ISS });
    const subcomisionId = payload.subcomisionId as string | undefined;
    const socioId = payload.socioId as string | undefined;
    const numeroSocio = payload.numeroSocio as string | undefined;
    if (!subcomisionId || !socioId || !numeroSocio) return null;
    return { subcomisionId, socioId, numeroSocio };
  } catch {
    return null;
  }
}
