import * as React from 'react';
import { cn } from '@/lib/utils';
import type { BatchStatus } from '@/lib/database.types';
import { expiryColor } from '@/lib/expiry';
import { statusLabel } from '@/lib/i18n';

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold', className)} {...props} />;
}

export function StatusBadge({ status }: { status: BatchStatus }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', expiryColor(status))}>
      {statusLabel(status)}
    </span>
  );
}
