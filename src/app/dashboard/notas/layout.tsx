"use client";

import type { ReactNode } from "react";
import { SubcomisionModuleGuard } from "@/components/subcomision/SubcomisionModuleGuard";

export default function NotasLayout({ children }: { children: ReactNode }) {
  return <SubcomisionModuleGuard moduleKey="notas">{children}</SubcomisionModuleGuard>;
}
