/**
 * Verificación de permisos para posts. Solo server-side.
 */

import { getAdminFirestore } from "@/lib/firebase-admin";

export type PostPermission = "create" | "edit" | "publish" | "unpublish" | "archive" | "view";

export async function canUserManagePosts(
  uid: string,
  subcomisionId: string,
  permission: PostPermission
): Promise<boolean> {
  const db = getAdminFirestore();

  const platformSnap = await db.doc(`platformUsers/${uid}`).get();
  const platformData = platformSnap.data() as { gerente_club?: boolean; super_admin?: boolean } | undefined;
  if (platformData?.super_admin === true) return true;

  const schoolUserSnap = await db.doc(`subcomisiones/${subcomisionId}/users/${uid}`).get();
  if (!schoolUserSnap.exists) return false;

  const role = (schoolUserSnap.data() as { role?: string })?.role ?? "";

  switch (permission) {
    case "view":
      return ["admin_subcomision", "encargado_deportivo", "editor", "viewer"].includes(role);
    case "create":
    case "edit":
      return ["admin_subcomision", "encargado_deportivo", "editor"].includes(role);
    case "publish":
    case "unpublish":
    case "archive":
      return role === "admin_subcomision";
    default:
      return false;
  }
}

export interface AuthUser {
  uid: string;
  email?: string;
  displayName?: string;
}

export async function getSchoolsForUser(
  auth: AuthUser
): Promise<Array<{ schoolId: string; schoolName: string; subcomisionSlug: string }>> {
  const db = getAdminFirestore();

  const platformSnap = await db.doc(`platformUsers/${auth.uid}`).get();
  const platformData = platformSnap.data() as { super_admin?: boolean } | undefined;
  if (platformData?.super_admin === true) {
    const subcomisionesSnap = await db.collection("subcomisiones").get();
    return subcomisionesSnap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        schoolId: d.id,
        schoolName: String(data.name ?? ""),
        subcomisionSlug: String(data.slug ?? d.id),
      };
    });
  }

  const userEmail = auth.email?.trim().toLowerCase();
  if (!userEmail) return [];

  const rolesSnap = await db.collectionGroup("users").where("email", "==", userEmail).get();
  const userRolesDocs = rolesSnap.docs.filter((d) => d.id === auth.uid);

  const result: Array<{ schoolId: string; schoolName: string; subcomisionSlug: string }> = [];
  const seen = new Set<string>();
  for (const doc of userRolesDocs) {
    const subcomisionIdFromRef = doc.ref.parent.parent?.id;
    if (!subcomisionIdFromRef || seen.has(subcomisionIdFromRef)) continue;
    seen.add(subcomisionIdFromRef);
    const schoolSnap = await db.doc(`subcomisiones/${subcomisionIdFromRef}`).get();
    if (!schoolSnap.exists) continue;
    const data = schoolSnap.data() as Record<string, unknown>;
    result.push({
      schoolId: subcomisionIdFromRef,
      schoolName: String(data.name ?? ""),
      subcomisionSlug: String(data.slug ?? subcomisionIdFromRef),
    });
  }

  return result;
}
