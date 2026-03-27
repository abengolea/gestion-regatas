"use client";

import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import { SubcomisionModuleGuard } from "@/components/subcomision/SubcomisionModuleGuard";

export default function ViajesLayout({ children }: { children: ReactNode }) {
  const params = useParams();
  const subcomisionId = params.subcomisionId as string;
  return (
    <SubcomisionModuleGuard moduleKey="viajes" schoolId={subcomisionId}>
      {children}
    </SubcomisionModuleGuard>
  );
}
