import { verifyAbonadoEntradasToken, type AbonadoEntradasClaims } from "@/lib/entradas/abonado-entradas-jwt";

export type AbonadoAuthOk = { claims: AbonadoEntradasClaims };
export type AbonadoAuthErr = { error: string; status: number };

export async function requireAbonadoEntradasAuth(request: Request): Promise<AbonadoAuthOk | AbonadoAuthErr> {
  const h = request.headers.get("Authorization");
  const token = h?.startsWith("Bearer ") ? h.slice(7).trim() : "";
  if (!token) {
    return { error: "Falta autorización", status: 401 };
  }
  const claims = await verifyAbonadoEntradasToken(token);
  if (!claims) {
    return { error: "Sesión inválida o vencida. Ingresá de nuevo tu número de socio.", status: 401 };
  }
  return { claims };
}
