'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';

const ATTRIBUTION_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
] as const;

export default function AxisPlannerAttributedLink({
  href,
  defaultSource,
  className,
  children,
}: {
  href: string;
  defaultSource: string;
  className: string;
  children: ReactNode;
}) {
  const searchParams = useSearchParams();
  const nextParams = new URLSearchParams({
    source: searchParams.get('source') || defaultSource,
  });

  for (const key of ATTRIBUTION_KEYS) {
    const value = searchParams.get(key);
    if (value) nextParams.set(key, value);
  }

  return (
    <Link href={`${href}?${nextParams.toString()}`} className={className}>
      {children}
    </Link>
  );
}
