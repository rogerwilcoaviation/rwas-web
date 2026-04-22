'use client';

/*
 * QuoteRequestForm — PDP-side quote CTA.
 *
 * Previous implementation was an inline mailto: form that opened the
 * user's mail client with a prefilled message to admin@rogerwilcoaviation.com.
 * That pattern was brittle (mailto fails on mobile/webmail), sent to the
 * wrong address, and bypassed our Turnstile spam protection.
 *
 * New pattern: redirect to the unified /contact page with product
 * context in the query string. The Correspondence Desk handles
 * validation, spam protection, and delivery to service@rwas.team.
 */

import Link from 'next/link';

export default function QuoteRequestForm({
  productTitle,
  sku,
}: {
  productTitle: string;
  sku?: string | null;
}) {
  const qs = new URLSearchParams({
    reason: 'quote',
    product: productTitle,
  });
  if (sku) qs.set('sku', sku);
  const href = `/contact?${qs.toString()}`;

  return (
    <div className="space-y-3 rounded-[1.5rem] border border-black/10 bg-white p-6 shadow-sm">
      <h3 className="text-xl font-bold text-[#111111]">Request a quote</h3>
      <p className="text-sm leading-6 text-black/65">
        Install-only and project-based Garmin items start with a quote. Send the
        shop your aircraft and mission details — we typically reply within one
        business day.
      </p>
      <Link
        href={href}
        className="bs-cta-primary inline-flex items-center justify-center"
      >
        Continue to Quote Request
      </Link>
      <p className="text-xs text-black/50">
        Routes to service@rwas.team with this product pre-filled.
      </p>
    </div>
  );
}
