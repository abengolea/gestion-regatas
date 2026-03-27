"use client";

import { SubcomisionModuleGuard } from "@/components/subcomision/SubcomisionModuleGuard";
import { SupportCenter } from "@/components/support/SupportCenter";

export default function SupportPage() {
  return (
    <SubcomisionModuleGuard moduleKey="support">
      <SupportCenter />
    </SubcomisionModuleGuard>
  );
}
