'use client';

import { Button } from '@/components/shared/ui/button';
import { useState } from 'react';

export default function QuoteRequestForm({
  productTitle,
  sku,
}: {
  productTitle: string;
  sku?: string | null;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [aircraft, setAircraft] = useState('');
  const [message, setMessage] = useState('');

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const subject = `RWAS Quote Request: ${productTitle}`;
    const body = [
      `Product: ${productTitle}`,
      sku ? `SKU: ${sku}` : null,
      `Name: ${name}`,
      `Email: ${email}`,
      `Aircraft: ${aircraft}`,
      '',
      'Project details:',
      message,
    ]
      .filter(Boolean)
      .join('\n');

    window.location.href = `mailto:admin@rogerwilcoaviation.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-[1.5rem] border border-black/10 bg-white p-6 shadow-sm">
      <div>
        <h3 className="text-xl font-bold text-[#111111]">Request a quote</h3>
        <p className="mt-2 text-sm leading-6 text-black/65">
          Install-only and project-based Garmin items start with a quote. Send the shop your aircraft and mission details.
        </p>
      </div>

      <input
        required
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Your name"
        className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-primary-500"
      />
      <input
        required
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Email address"
        className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-primary-500"
      />
      <input
        value={aircraft}
        onChange={(event) => setAircraft(event.target.value)}
        placeholder="Aircraft make / model"
        className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-primary-500"
      />
      <textarea
        required
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Tell RWAS what you're trying to accomplish."
        rows={5}
        className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-primary-500"
      />

      <Button type="submit" className="bg-[#111111] text-[#f5f3ef] hover:bg-black">
        Email quote request
      </Button>
    </form>
  );
}
