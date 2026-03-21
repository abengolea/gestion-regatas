'use client';

import { Badge } from '@/components/ui/badge';
import { CheckCircle } from 'lucide-react';

interface WebhookStatusBadgeProps {
  /** Si el webhook de MP está configurado y activo */
  activo?: boolean;
}

export function WebhookStatusBadge({ activo = false }: WebhookStatusBadgeProps) {
  if (!activo) return null;

  return (
    <Badge
      variant="outline"
      className="border-green-600 bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-400"
    >
      <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
      Webhook MP activo — pagos confirmados automáticamente
    </Badge>
  );
}
